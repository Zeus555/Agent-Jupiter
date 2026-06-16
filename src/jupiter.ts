import type { Page } from 'playwright';
import { getPage, closeBrowser, cleanupTabs } from './browser.js';
import dotenv from 'dotenv';
import { approveConnection, directUnlock } from './phantom.js';
import { logger } from './logger.js';
import { pageLock } from './mutex.js';


dotenv.config();

async function withPageLock<T>(fn: () => Promise<T>): Promise<T> {
    const release = await pageLock.acquire();
    try {
        return await fn();
    } finally {
        release();
    }
}

const JUPITER_PERPS_URL = 'https://jup.ag/perps';
const MAX_CONSECUTIVE_FAILURES = 5;
let consecutiveFailures = 0;
let isTradeInProgress = false;
// Maintenance mode: set during wallet import/forget so background tasks (warmer) pause and
// the self-healing browser-restart is suppressed — those would otherwise close the browser
// out from under the wallet-import flow.
let maintenanceMode = false;
export const setMaintenanceMode = (v: boolean) => { maintenanceMode = v; logger.info(`[maintenance] ${v ? 'ON' : 'OFF'}`); };
export const isMaintenance = () => maintenanceMode;

/**
 * Self-healing: Reset browser if failures accumulate.
 */
const reportFailure = () => {
    consecutiveFailures++;
    logger.info(`[Self-Healing] Failure reported (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && !maintenanceMode) {
        console.warn(`[Self-Healing] FATAL: ${consecutiveFailures} consecutive failures. Triggering browser restart...`);
        consecutiveFailures = 0;
        // This will force re-initialization on next getPage() call
        closeBrowser().catch(() => {});
    }
};

const reportSuccess = () => {
    consecutiveFailures = 0;
};

// --- CACHE SYSTEM (for millisecond response times) ---
// Prices are ALWAYS read from the Jupiter UI (never an external API). A background
// "warmer" keeps the cache fresh so the HTTP API can answer from memory in <5ms.
let balanceCache: Record<string, string> = {};
let lastBalanceUpdate = 0;
const BALANCE_CACHE_TTL = 20000; // 20 seconds

let priceCache: Record<string, { price: string; timestamp: number }> = {};

// How old a cached price may be and still be served straight from memory (ms).
// Must comfortably exceed the warmer's full cycle time across all tracked assets
// (one browser tab can only show one market at a time), so that actively-polled
// assets are virtually always a cache hit (sub-ms). The warmer keeps them fresher
// than this in practice. Lower it for fresher prices at the cost of more cold reads.
const PRICE_SERVE_TTL = Number(process.env.PRICE_SERVE_TTL) || 15000;
// Background warmer cadence and the age at which a tracked asset is refreshed via navigation.
// PRICE_WARM_STALE is deliberately well below PRICE_STALE_MAX but NOT tiny: a single tab
// can only show one market at a time, so chasing sub-second freshness for every asset means
// navigating continuously, which starves the event loop and hammers the trading page. We only
// need each asset cached within PRICE_STALE_MAX for the fast path to answer in ms; refreshing
// every ~12s keeps prices reasonably fresh while leaving the page (and CPU) calm.
// Typical usage monitors ONE asset at a time and leaves it loaded, so in steady state
// the warmer just re-reads the currently displayed market every tick with NO navigation
// (cheap DOM read) — keeping that asset ~1s fresh with zero latency spikes. Navigation
// only happens when a *different* tracked asset goes stale (PRICE_WARM_STALE), which is
// rare under single-asset monitoring.
const PRICE_WARM_INTERVAL = Number(process.env.PRICE_WARM_INTERVAL) || 1000;
const PRICE_WARM_STALE = Number(process.env.PRICE_WARM_STALE) || 12000;
// Per-read DOM polling granularity (ms) — tighter than the old 1000ms for faster cold reads.
const PRICE_POLL_MS = Number(process.env.PRICE_POLL_MS) || 250;
// Absolute ceiling: a cached price older than this is considered unusable and forces a
// (blocking) cold read. As long as the warmer is healthy, prices stay far fresher, so
// the API answers from cache in ms; this only guards against a stalled/broken warmer.
const PRICE_STALE_MAX = Number(process.env.PRICE_STALE_MAX) || 60000;
// Drop an asset from background warming if it hasn't been requested in this window (ms).
// Keeps the warmer focused on what's actually being polled: under single-asset
// monitoring the others age out and the page parks on the one asset (always ~1s fresh,
// flat ms latency, no navigation). Lower = converges faster after switching assets.
const PRICE_REQUEST_TTL = Number(process.env.PRICE_REQUEST_TTL) || 60000;

// Assets the API has been asked for recently → the only ones the warmer keeps hot.
// Purely demand-driven: starts EMPTY and only tracks what is actually requested in the
// last PRICE_REQUEST_TTL. (Previously this was seeded with SOL and SOL was protected from
// pruning, so the warmer rotated SOL<->WBTC forever — reloading the page every couple of
// seconds even when nobody asked for SOL. With this empty/demand-only set, if production
// only polls one asset the page parks on it and never navigates.)
const requestedAssets = new Map<string, number>();
let priceWarmerStarted = false;

let balanceIntervalStarted = false;

/**
 * Parse the market currently displayed by the page from its URL.
 * Jupiter perps URLs look like `…/perps/<long|short>/SOL-<MARKET>`; the bare
 * `…/perps` page defaults to the SOL market. Returns the uppercased market
 * symbol, or null if it can't be determined.
 *
 * NOTE: the previous code used `url.includes(symbol)`, which is ALWAYS true for
 * "SOL" (every pair is prefixed "SOL-"), so SOL price reads never navigated and
 * silently returned whatever other market happened to be on screen. This parses
 * the actual traded asset (the second token) instead.
 */
const getCurrentMarket = (url: string): string | null => {
    const pair = url.match(/\/perps(?:\/(?:long|short))?\/SOL-([A-Za-z0-9]+)/);
    if (pair && pair[1]) return pair[1].toUpperCase();
    if (/jup\.ag\/perps\/?(?:[?#]|$)/.test(url)) return 'SOL';
    return null;
};

/**
 * Sanity-checks that a price string is in the plausible range for an asset. Used to
 * reject garbage/loading values and (as a secondary guard) a grossly wrong market.
 */
const inRange = (symbol: string, priceStr: string | null): boolean => {
    if (!priceStr) return false;
    const val = parseFloat(String(priceStr).replace(/[$,]/g, ''));
    if (isNaN(val) || val <= 0) return false;
    if (symbol === 'WBTC') return val >= 10000;
    if (symbol === 'ETH') return val >= 100 && val < 10000;
    if (symbol === 'SOL') return val >= 5 && val < 10000;
    return true;
};

/**
 * Reads the Mark Price currently displayed on the page as a raw "$N" string, WITHOUT
 * asserting which asset it belongs to. The CALLER is responsible for knowing the
 * displayed market (via getCurrentMarket(page.url()), the reliable signal) and for
 * range-validating with inRange().
 *
 * Why not gate on the document title (as before)? Jupiter's SPA normalizes a URL like
 * `…/SOL-SOL` to the bare `…/perps`, whose title doesn't contain "SOL". A title gate
 * therefore made the SOL read silently fail, so the warmer could never keep SOL fresh
 * via the cheap no-navigation path. The URL is the dependable market indicator.
 *
 * Does NOT acquire the page lock — the caller must hold it.
 */
const readMarkPrice = async (page: Page): Promise<string | null> => {
    const found = await page.evaluate(`
        (function() {
            const num = (p) => {
                if (!p) return null;
                const clean = String(p).trim().replace(/[$,]/g, '');
                const val = parseFloat(clean);
                return (isNaN(val) || val <= 0) ? null : String(p).trim();
            };

            // Strategy A: page title leading number — e.g. "169.42 | SOL-PERP | Jupiter".
            // This is the displayed market's live price.
            const tm = (document.title || '').match(/^([\\d,.]+)/);
            if (tm && num(tm[1])) return '$' + tm[1];

            // Strategy B: the "Mark Price" label's sibling/parent value.
            const markPriceLabel = Array.from(document.querySelectorAll('span, div'))
                .find(e => e.innerText && e.innerText.trim() === 'Mark Price');
            if (markPriceLabel) {
                let val = markPriceLabel.nextElementSibling && markPriceLabel.nextElementSibling.innerText;
                if (val) val = val.trim();
                if (num(val)) return val;
                const parent = markPriceLabel.parentElement;
                if (parent && parent.children[1]) {
                    val = parent.children[1].innerText && parent.children[1].innerText.trim();
                    if (num(val)) return val;
                }
            }

            // Strategy C: prominent font-mono price elements.
            const monoPrices = Array.from(document.querySelectorAll('.font-mono'));
            for (const el of monoPrices) {
                const t = el.innerText && el.innerText.trim();
                if (num(t)) {
                    const fontSize = parseFloat(window.getComputedStyle(el).fontSize);
                    if (fontSize >= 14) return t;
                }
            }
            return null;
        })()
    `);
    return (found as string) || null;
};

/**
 * Navigates to the asset's market if needed and polls the DOM until a valid
 * price is read, updating the cache. Does NOT acquire the page lock — the caller
 * must hold it. Returns the price string, or null if it couldn't be read.
 */
const refreshPrice = async (page: Page, symbol: string, maxAttempts: number): Promise<string | null> => {
    if (getCurrentMarket(page.url()) !== symbol) {
        if (isTradeInProgress) {
            // Don't yank the page to another market mid-trade.
            throw new Error('BUSY_TRADING');
        }
        const targetUrl = `https://jup.ag/perps/short/SOL-${symbol}`;
        logger.info(`[refreshPrice] Navigating -> ${symbol} (${targetUrl})`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    }

    for (let i = 0; i < maxAttempts; i++) {
        // Only trust a reading once the URL confirms the page settled on this market
        // (the SPA may still be transitioning right after goto).
        if (getCurrentMarket(page.url()) === symbol) {
            const price = await readMarkPrice(page);
            if (inRange(symbol, price)) {
                priceCache[symbol] = { price: price as string, timestamp: Date.now() };
                reportSuccess();
                return price;
            }
        }
        await page.waitForTimeout(PRICE_POLL_MS);
    }
    return null;
};

/**
 * Background loop that keeps the price cache warm so the API answers in ms.
 * Every tick (when no trade is running) it cheaply re-reads the currently
 * displayed market, then navigates to refresh the stalest *requested* asset.
 * All UI work happens under the page lock and yields to trades.
 */
export const startPriceWarmer = (page: Page) => {
    if (priceWarmerStarted) return;
    if (process.env.PRICE_WARMER === 'false') return;
    priceWarmerStarted = true;
    logger.info(`[PriceWarmer] Started (interval=${PRICE_WARM_INTERVAL}ms, staleAfter=${PRICE_WARM_STALE}ms).`);

    const tick = async () => {
        try {
            if (!isTradeInProgress && !maintenanceMode) {
                await withPageLock(async () => {
                    const now = Date.now();

                    // Prune assets nobody has asked for recently (no special-casing).
                    for (const [sym, ts] of requestedAssets) {
                        if (now - ts > PRICE_REQUEST_TTL) requestedAssets.delete(sym);
                    }

                    // 1. Cheap refresh of whatever market is already on screen (no navigation).
                    // The URL tells us which market is displayed; read its Mark Price directly.
                    const current = getCurrentMarket(page.url());
                    if (current) {
                        const price = await readMarkPrice(page).catch(() => null);
                        if (inRange(current, price)) priceCache[current] = { price: price as string, timestamp: Date.now() };
                    }

                    // 2. Navigate to refresh the stalest requested asset that needs it.
                    const stale = [...requestedAssets.keys()]
                        .filter(sym => sym !== current)
                        .filter(sym => {
                            const c = priceCache[sym];
                            return !c || Date.now() - c.timestamp > PRICE_WARM_STALE;
                        })
                        .sort((a, b) => (priceCache[a]?.timestamp || 0) - (priceCache[b]?.timestamp || 0));

                    if (stale.length > 0 && !isTradeInProgress) {
                        await refreshPrice(page, stale[0]!, 8).catch(() => {});
                    }
                });
            }
        } catch {
            // Warmer is best-effort; never let it crash the loop.
        } finally {
            setTimeout(tick, PRICE_WARM_INTERVAL);
        }
    };

    setTimeout(tick, PRICE_WARM_INTERVAL);
};

export const runBalanceUpdate = async (page: Page) => {
    return withPageLock(async () => {
        try {
            logger.info('[BalanceCache] Updating balances from UI...');
            const tokens = ['SOL', 'USDC', 'WBTC', 'ETH'];
            const newBalances = await fetchBalancesFromUI(page, tokens);
            if (Object.keys(newBalances).length > 0) {
                balanceCache = { ...balanceCache, ...newBalances };
                lastBalanceUpdate = Date.now();
                logger.info('[BalanceCache] Balances updated successfully.');
            }
        } catch (e: any) {
            logger.warn('[BalanceCache] Balance update failed: ' + e.message);
        }
    });
};

// How often to refresh balances once a first reading has succeeded (ms).
const BALANCE_REFRESH_INTERVAL = Number(process.env.BALANCE_REFRESH_INTERVAL) || 60000;
// While we have never managed to read balances, retry this fast (ms).
const BALANCE_BOOTSTRAP_INTERVAL = Number(process.env.BALANCE_BOOTSTRAP_INTERVAL) || 10000;

export const startBalanceUpdates = async (page: Page) => {
    if (balanceIntervalStarted) return;
    balanceIntervalStarted = true;
    logger.info('[BalanceCache] Starting balance update loop...');

    const loop = async () => {
        let delay = BALANCE_REFRESH_INTERVAL;
        try {
            await runBalanceUpdate(page);
            if (Object.keys(balanceCache).length === 0) {
                // Never populated yet → keep retrying quickly until we get a first reading.
                delay = BALANCE_BOOTSTRAP_INTERVAL;
            }
        } catch (e: any) {
            logger.warn('[BalanceCache] Balance update failed: ' + e.message);
            delay = Object.keys(balanceCache).length === 0 ? BALANCE_BOOTSTRAP_INTERVAL : BALANCE_REFRESH_INTERVAL;
        } finally {
            setTimeout(loop, delay);
        }
    };
    loop().catch(err => logger.error('[BalanceCache] Loop error:', err));
};

/**
 * Snapshot of the price cache (for /health). Does not touch the browser.
 */
export const getPriceMeta = (): { warmerRunning: boolean; tracked: string[]; prices: Record<string, { price: string; ageMs: number }> } => {
    const now = Date.now();
    const prices: Record<string, { price: string; ageMs: number }> = {};
    for (const [sym, entry] of Object.entries(priceCache)) {
        prices[sym] = { price: entry.price, ageMs: now - entry.timestamp };
    }
    return { warmerRunning: priceWarmerStarted, tracked: [...requestedAssets.keys()], prices };
};

/**
 * Metadata about the balance cache so callers can tell a real "0" from "never loaded".
 */
export const getBalanceMeta = (): { lastUpdated: number | null; stale: boolean; hasData: boolean } => {
    const hasData = Object.keys(balanceCache).length > 0;
    return {
        lastUpdated: lastBalanceUpdate || null,
        stale: !hasData || (Date.now() - lastBalanceUpdate > BALANCE_REFRESH_INTERVAL * 2),
        hasData
    };
};


// Internal function for the actual UI scraping
const fetchBalancesFromUI = async (page: Page, tokens: string[]): Promise<Record<string, string>> => {
    try {
        const isReady = await isPageReadyInternal(page);
        if (!isReady) {
            logger.warn('[fetchBalancesFromUI] Page is not ready.');
            return {};
        }

        const amountInput = page.getByPlaceholder('0.00').filter({ hasNotText: 'x' }).first();
        const tokenSelector = amountInput.locator('xpath=../..').locator('button').first();
        
        if (!(await tokenSelector.isVisible({ timeout: 2000 }))) {
            logger.warn('[fetchBalancesFromUI] tokenSelector is not visible.');
            return {};
        }
        
        await tokenSelector.click();
        
        // Dynamic wait: Wait until the dialog is visible and contains at least one row with a numeric balance
        let results: Record<string, string> = {};
        const maxPollAttempts = 10; // 10 * 200ms = 2s max
        let foundAnyRows = false;
        for (let i = 0; i < maxPollAttempts; i++) {
            const evalRes = await page.evaluate(() => {
                const data: Record<string, string> = {};
                const rows = Array.from(document.querySelectorAll('div[role="dialog"] .cursor-pointer, div[role="dialog"] [class*="cursor-pointer"]'));
                const hasRows = rows.length > 0;
                
                rows.forEach(row => {
                    const text = (row as HTMLElement).innerText || "";
                    const parts = text.split('\n').map(p => p.trim()).filter(p => p.length > 0);
                    const firstPart = parts[0];
                    if (parts.length >= 2 && firstPart) {
                        const symbol = firstPart.toUpperCase();
                        const balancePart = parts.find(p => {
                            const clean = p.replace(/,/g, '');
                            return /^\d+\.?\d*$/.test(clean) && !p.startsWith('$');
                        });
                        if (balancePart) data[symbol] = balancePart;
                    }
                });
                return { data, hasRows };
            });

            results = evalRes.data;
            if (evalRes.hasRows) foundAnyRows = true;

            // If we found at least one balance (like SOL), we can stop waiting
            if (Object.keys(results).length > 0) break;
            await page.waitForTimeout(200);
        }

        await page.keyboard.press('Escape');
        
        // If we found rows, but no numeric balances, it means the wallet is connected but has 0 balances
        if (Object.keys(results).length === 0 && foundAnyRows) {
            logger.info('[fetchBalancesFromUI] Dialog was open but no balances found. Defaulting tokens to 0.');
            for (const token of tokens) {
                results[token.toUpperCase()] = "0";
            }
        } else if (Object.keys(results).length === 0) {
            logger.warn('[fetchBalancesFromUI] Scraping completed but no balances were found in the dialog.');
        }
        return results;
    } catch (e: any) {
        logger.error('[fetchBalancesFromUI] Error scraping balances: ' + e.message);
        return {};
    }
};

export const getBalances = async (page: Page | null, tokens: string[]): Promise<Record<string, string>> => {
    const result: Record<string, string> = {};
    for (const token of tokens) {
        result[token.toUpperCase()] = balanceCache[token.toUpperCase()] || "0";
    }
    return result;
};

export const isPageReadyInternal = async (page: Page): Promise<boolean> => {
    try {
        const url = page.url();
        if (!url.includes('jup.ag/perps')) return false;

        // Robust Health Check: Balance + Price
        const health = await page.evaluate(() => {
            const allElements = Array.from(document.querySelectorAll('span, div, p, button'));

            // 1. Price Check
            let hasPrice = false;
            const labelEl = allElements.find(e => (e as HTMLElement).innerText?.trim() === 'Mark Price');
            if (labelEl) {
                const updatedPrice = labelEl.nextElementSibling?.textContent?.trim();
                if (updatedPrice && updatedPrice.startsWith('$') && !/[MKB]$/i.test(updatedPrice)) hasPrice = true;
                // Fallback: check parent
                if (!hasPrice && labelEl.parentElement) {
                    hasPrice = (labelEl.parentElement as HTMLElement).innerText.includes('$');
                }
            }
            if (!hasPrice) {
                // Fallback 2: Any valid price element
                hasPrice = allElements.some(el => {
                    const txt = (el as HTMLElement).innerText?.trim();
                    return txt && txt.startsWith('$') && /\d/.test(txt) && txt.length < 15 && !txt.includes('Loading') && !/[MKB]$/i.test(txt) && el.className.includes('font-mono');
                });
            }

            // 2. Balance Check (The real truth of connection)
            let hasBalance = false;
            // Look for labeled balance
            hasBalance = allElements.some(e => {
                const t = (e as HTMLElement).innerText;
                return t && (t.includes('Balance:') || t.includes('Available:')) && /\d/.test(t);
            });
            // Look for raw SOL balance
            if (!hasBalance) {
                hasBalance = allElements.some(s => {
                    const t = (s as HTMLElement).innerText;
                    return t && t.includes('SOL') && /\d/.test(t) && t.length < 30 &&
                        !t.includes('paying') && !t.includes('receiving') &&
                        !s.closest('input') && !s.closest('.trade-form');
                });
            }

            // 3. Wallet Button Check (Fallback if balance is 0 or hidden)
            const hasWalletBtn = allElements.some(e => {
                if (e.tagName !== 'BUTTON') return false;
                const t = (e as HTMLElement).innerText?.trim();
                return t && t.length > 2 && t.length < 20 && !t.includes('Connect') && /[a-zA-Z0-9]/.test(t);
            });

            // 4. Stale Check: If stuck in "Connecting", force reload
            const isConnecting = allElements.some(e => {
                return e.tagName === 'BUTTON' && (e as HTMLElement).innerText?.includes('Connecting');
            });
            if (isConnecting && !(hasBalance || hasWalletBtn)) return { ok: false, reason: 'connecting' };

            // 5. Critical Error Check: RPC failure
            const hasError = allElements.some(e => {
                const t = (e as HTMLElement).innerText;
                // Check specifically for the yellow banner text
                return t && (t.includes('RPC is not responding') || t.includes('Try changing your RPC'));
            });
            if (hasError) return { ok: false, reason: 'rpc_error' };

            const ok = (hasBalance || hasWalletBtn) && hasPrice;
            return { ok, reason: { hasBalance, hasWalletBtn, hasPrice } };
        });

        if (typeof health === 'object' && health !== null) {
            if (!health.ok) {
                logger.info(`[isPageReady] Page NOT ready. Reason: ${JSON.stringify(health.reason)}`);
            }
            return !!health.ok;
        }
        return !!health;
    } catch (e) {
        return false;
    }
};

export const isPageReady = async (page: Page): Promise<boolean> => {
    return withPageLock(async () => {
        return await isPageReadyInternal(page);
    });
};

const connectWalletInternal = async (page: Page) => {
    // Dismiss any browser-level popups (like Restore Pages)
    await page.keyboard.press('Escape').catch(() => { });

    const getConnectState = async () => await page.evaluate(() => {
        const text = document.body.innerText;

        // 1. Priority: Check for address in button (Definitive connected state)
        const buttons = Array.from(document.querySelectorAll('button'));
        const walletBtn = buttons.find(b => {
            const t = b.innerText?.trim();
            return t && /[a-zA-Z0-9]{2,}\.{2,}[a-zA-Z0-9]{2,}/.test(t);
        });
        if (walletBtn) return 'connected';

        // 2. Connecting State: If not definitively connected, check for connecting text
        if (text.includes('Connecting')) return 'connecting';

        // 3. Fallback: Check body for address pattern (Legacy stable behavior)
        const addressPattern = /[a-zA-Z0-9]{2,}\.{2,}[a-zA-Z0-9]{2,}/;
        if (addressPattern.test(text)) return 'connected';

        return 'disconnected';
    });

    let state = await getConnectState();
    logger.info(`[connectWallet] Current state: ${state}`);

    if (state === 'connected') {
        logger.info('Wallet already connected. Skipping connect flow.');
        return;
    }

    // 1. Ensure extension is unlocked (No refresh)
    logger.info('Ensuring Phantom extension is unlocked...');
    await directUnlock(page.context() as any);

    // Re-check state after potential unlock
    state = await getConnectState();
    logger.info(`[connectWallet] State after directUnlock: ${state}`);
    if (state === 'connected') return;

    // 2. Refresh if disconnected, or wait if connecting
    if (state === 'disconnected') {
        logger.info('Wallet disconnected. Refreshing Jupiter...');
        await page.goto(JUPITER_PERPS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
        await page.waitForTimeout(5000);
    } else if (state === 'connecting') {
        logger.info('Wallet in "Connecting" state. Waiting for resolution...');
        for (let i = 0; i < 4; i++) {
            await page.waitForTimeout(2000);
            if (await getConnectState() === 'connected') return;
        }
        logger.info('Wallet stuck in "Connecting" state. Refreshing page...');
        await page.goto(JUPITER_PERPS_URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
        await page.waitForTimeout(5000);
    }

    state = await getConnectState();
    if (state === 'connected') return;

    // 3. Manual Connection Attempt
    logger.info('Cleaning up existing tabs before manual connection...');
    await cleanupTabs(page.context());

    logger.info('Triggering manual connection flow...');
    const connectBtn = page.locator('button:has-text("Connect"), button:has-text("Connecting")').first();
    if (await connectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await connectBtn.click();
        await page.waitForTimeout(2000);
        const phantomSelectors = [
            'div[role="dialog"] button:has(img[alt*="Phantom"])',
            'div[role="dialog"] button:has-text("Phantom")',
            'div[role="dialog"] img[alt*="Phantom"]'
        ];
        for (const selector of phantomSelectors) {
            const locator = page.locator(selector).first();
            if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
                await locator.click({ force: true });
                await approveConnection(page.context() as any);
                logger.info('Wallet connected. Forcing full reload to ensure UI sync...');
                await page.goto(JUPITER_PERPS_URL, { waitUntil: 'domcontentloaded' }).catch(() => { });
                await page.waitForTimeout(5000); // Wait for hydration
                return;
            }
        }
    }
};

export const connectWallet = async (page: Page) => {
    return withPageLock(async () => {
        await connectWalletInternal(page);
    });
};

/**
 * Counts the current active positions from the Jupiter UI.
 * Uses the count in the "Positions" tab as the primary source.
 */
const countPositions = async (page: Page): Promise<number> => {
    return await page.evaluate(() => {
        // 1. Check for "Positions (N)" tab text
        const allElements = Array.from(document.querySelectorAll('span, div, p, button'));
        const positionsTab = allElements.find(e => {
            const t = (e as HTMLElement).innerText;
            return t && t.trim().startsWith('Positions');
        });
        
        if (positionsTab) {
            const text = (positionsTab as HTMLElement).innerText || "";
            const match = text.match(/\(\s*(\d+)\s*\)/);
            if (match && match[1]) return parseInt(match[1], 10);
        }

        // 2. Fallback: Count actual position cards
        const tradeForm = document.querySelector('.bg-perps-form-bg')?.closest('div');
        const positionsContainer = positionsTab?.closest('div')?.parentElement?.parentElement;
        if (positionsContainer) {
            const containers = Array.from(positionsContainer.querySelectorAll('div, li')).filter(el => {
                const t = (el as HTMLElement).innerText || "";
                const isInsideTradeForm = tradeForm && tradeForm.contains(el);
                return !isInsideTradeForm && t.includes('Entry Price') && t.includes('Size') && t.length < 800;
            });
            const specificContainers = containers.filter(c => !containers.some(other => c !== other && c.contains(other)));
            return specificContainers.length;
        }

        // 3. Last fallback: Check for "No open positions"
        const bodyText = document.body.innerText || "";
        if (bodyText.includes('No open positions')) return 0;

        return 0;
    }).catch(() => 0);
};

export const getPrice = async (page: Page, asset: string = 'SOL'): Promise<{ price: string; asset: string; ageMs: number; stale: boolean }> => {
    const symbol = asset.toUpperCase().trim();

    // Record demand so the background warmer keeps this asset hot from now on.
    requestedAssets.set(symbol, Date.now());

    // During maintenance (wallet import/forget) the browser is being reset, so never touch the
    // UI — serve the last cached value (flagged stale) or report unavailable. This stops price
    // polling from interfering with the wallet flow.
    if (maintenanceMode) {
        const c = priceCache[symbol];
        if (c) return { price: c.price, asset: symbol, ageMs: Date.now() - c.timestamp, stale: true };
        throw new Error('MAINTENANCE: wallet operation in progress, price temporarily unavailable.');
    }

    // FAST PATH (the norm): serve from the in-memory cache WITHOUT taking the page lock.
    // This returns in well under 1ms even while the warmer is navigating the page for a
    // different asset. We serve any cache up to PRICE_STALE_MAX old (not just "fresh")
    // so the API never blocks on the UI for an asset that's already being warmed — the
    // warmer refreshes it in the background. `stale` flags prices past PRICE_SERVE_TTL.
    const cached = priceCache[symbol];
    if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < PRICE_STALE_MAX) {
            return { price: cached.price, asset: symbol, ageMs: age, stale: age >= PRICE_SERVE_TTL };
        }
    }

    // COLD PATH: never seen this asset (or the warmer stalled and it's very old).
    // Read it from the UI under the page lock — this is the only blocking case.
    return withPageLock(async () => {
        const c2 = priceCache[symbol];
        if (c2 && (Date.now() - c2.timestamp < PRICE_STALE_MAX)) {
            const age = Date.now() - c2.timestamp;
            return { price: c2.price, asset: symbol, ageMs: age, stale: age >= PRICE_SERVE_TTL };
        }

        logger.info(`[getPrice] Cold read for ${symbol} (no usable cache). Reading from UI...`);
        const price = await refreshPrice(page, symbol, 15);
        if (price) {
            logger.info(`[getPrice] SUCCESS: ${symbol} = ${price}`);
            return { price, asset: symbol, ageMs: 0, stale: false };
        }

        reportFailure();
        throw new Error(`[getPrice] FATAL: Could not read a valid price for ${symbol} from the UI. Current page: "${page.url()}". This may be a network delay or an unsupported asset.`);
    });
};

export const openPosition = async (page: Page, side: 'long' | 'short', amount: number, asset?: string, leverage?: number, takeProfit?: number, stopLoss?: number, collateral?: string) => {
    let success = false;
    await withPageLock(async () => {
        const initialCount = await countPositions(page);
        logger.info(`[openPosition] Pre-trade verification: Current positions: ${initialCount}`);
        
        isTradeInProgress = true;
        try {
            const payToken = (collateral || 'USDC').toUpperCase();
            const tabName = side === 'long' ? 'Long/Buy' : 'Short/Sell';
            const baseUrl = 'https://jup.ag/perps';

            logger.info(`[openPosition] Starting v1.6.0 (Strict Proof) sequence...`);

            // --- PHASE 1: CONFIGURATION ---
            await page.bringToFront().catch(() => {});
            logger.info(`Configuring ${side.toUpperCase()} trade for ${amount} ${payToken} (Asset: ${asset || 'SOL'})...`);
        
            // Select Side Tab
            await page.getByText(tabName, { exact: true }).first().click().catch(() => {});
            await page.waitForTimeout(1000);

            // Select Market
            const marketLocator = page.locator('button').filter({ hasText: /^Market$/ }).first();
            await marketLocator.click().catch(() => {});
            await page.waitForTimeout(1000);

            // Select Asset
            if (asset) {
                const assetTab = page.getByRole('button').filter({ hasText: new RegExp(`^${asset}$`, 'i') }).first();
                if (await assetTab.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await assetTab.click();
                    await page.waitForTimeout(1000);
                }
            }

            // Amount & Collateral
            const amountInput = page.getByPlaceholder('0.00').filter({ hasNotText: 'x' }).first();
            const tokenSelector = amountInput.locator('xpath=../..').locator('button').first();
            const currentToken = await tokenSelector.innerText().catch(() => '');
            if (!currentToken.toUpperCase().includes(payToken)) {
                await tokenSelector.click();
                await page.waitForTimeout(1000);
                const tokenOption = page.locator('div[role="dialog"]').getByText(payToken, { exact: true }).first();
                if (await tokenOption.isVisible({ timeout: 3000 }).catch(() => false)) {
                    await tokenOption.click();
                    await page.waitForTimeout(1500);
                }
            }
            await page.locator('input.text-right').first().fill(amount.toString());

            // Leverage
            if (leverage) {
                const leverageInput = page.locator('input.text-center').first();
                if (await leverageInput.isVisible({ timeout: 2000 })) {
                    await leverageInput.click();
                    await page.keyboard.press('Control+A');
                    await page.keyboard.press('Backspace');
                    await leverageInput.type(leverage.toString(), { delay: 50 });
                    await leverageInput.press('Enter');
                    await page.waitForTimeout(1000);
                }
            }

            // TP/SL
            if (takeProfit || stopLoss) {
                const tpContainerInput = page.locator('.bg-perps-form-secondary-bg').filter({ hasText: 'TP Price' }).locator('input').first();
                if (!(await tpContainerInput.isVisible({ timeout: 2000 }).catch(() => false))) {
                    await page.getByText('Take Profit / Stop Loss').first().click();
                    await page.waitForTimeout(500);
                }
                if (takeProfit) await page.locator('.bg-perps-form-secondary-bg').filter({ hasText: 'TP Price' }).locator('input').first().fill(takeProfit.toString());
                if (stopLoss) await page.locator('.bg-perps-form-secondary-bg').filter({ hasText: 'SL Price' }).locator('input').first().fill(stopLoss.toString());
            }

            // Wait for indicators to settle
            await page.waitForTimeout(3000);

            // --- PHASE 2: STRICT VALIDATION (FATAL) ---
            const validation = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const mainBtn = btns.reverse().find((b: any) => 
                    b.offsetWidth > 100 && b.innerText && 
                    !b.innerText.includes('Connect Wallet') && !b.innerText.includes('Max')
                );
                const btnText = (mainBtn?.innerText || '').trim().replace(/\n+/g, ' ');
                
                // Strict format: "[Side]/[Op] [Amount] [Asset]" (e.g., "Long/Buy 0.0116 WBTC")
                // We allow some flexibility in whitespace/exact match but require the core elements
                const isValid = btnText.match(/(Long|Short)\/(Buy|Sell)\s[\d.]+(\s[A-Z0-9]+)?/i);
                
                if (isValid) return { ok: true, text: btnText };

                // --- ROBUST ERROR EXTRACTION (Multi-strategy fallback) ---
                let alertMsg: string | null = null;

                // Strategy A: Original approach — index [11] of the known class (fast, works when DOM is stable)
                const legacyLabel = document.getElementsByClassName('flex items-center space-x-2')[11] as HTMLElement;
                if (legacyLabel) {
                    const t = legacyLabel.innerText.trim().replace(/\n+/g, ' ');
                    if (t.length > 2 && t.length < 150) alertMsg = t;
                }

                // Strategy B: Scan the trade form area for warning-colored text elements
                if (!alertMsg) {
                    const formRoot = document.querySelector('.bg-perps-form-bg') as HTMLElement || document.body;
                    const candidates = Array.from(formRoot.querySelectorAll('div, span, p')) as HTMLElement[];
                    for (const el of candidates) {
                        const style = window.getComputedStyle(el);
                        const color = style.color;
                        // Match typical Tailwind red/amber warning RGB values
                        const isWarning = (
                            color.includes('rgb(239, 68, 68)')   || // red-500
                            color.includes('rgb(220, 38, 38)')   || // red-600
                            color.includes('rgb(245, 158, 11)')  || // amber-500
                            color.includes('rgb(234, 179, 8)')      // yellow-500
                        );
                        const text = el.innerText?.trim().replace(/\n+/g, ' ') || '';
                        // Avoid capturing large containers; only leaf-level messages
                        if (isWarning && text.length > 2 && text.length < 150 && el.children.length < 3) {
                            alertMsg = text;
                            break;
                        }
                    }
                }

                // Strategy C: Scan for any disabled-state hint on the main button
                if (!alertMsg && mainBtn) {
                    const disabledHint = mainBtn.getAttribute('title') || mainBtn.getAttribute('aria-label') || '';
                    if (disabledHint.length > 2) alertMsg = disabledHint;
                }

                return { ok: false, text: btnText, error: alertMsg || 'Unknown validation error — button not ready.' };
            });

            if (!validation.ok) {
                console.warn(`[openPosition] FATAL Validation Error: "${validation.error}" (Button: "${validation.text}")`);
                throw new Error(`Execution stopped: Jupiter UI reported a validation error: "${validation.error}". Button state: "${validation.text}".`);
            }

            logger.info(`Validation passed: Button indicates "${validation.text}". Proceeding to Interaction Phase.`);

            // --- PHASE 3: INTERACTION LOOP (5 CLICK ATTEMPTS) ---
            let popupApproved = false;
            for (let i = 1; i <= 5; i++) {
                logger.info(`[Interaction] Attempt ${i}/5: Clicking button to trigger wallet...`);
                
                // Click the trade button
                await page.evaluate((s) => {
                    const selector = s === 'long' ? 'button.bg-v3-background-perps-green' : 'button.bg-v3-perps-red';
                    const btn = document.querySelector(selector) as HTMLElement;
                    if (btn && btn.offsetParent !== null) {
                        btn.click();
                    } else {
                        const btns = Array.from(document.querySelectorAll('button'));
                        const mainBtn = btns.reverse().find((b: any) => 
                            b.offsetWidth > 150 && b.innerText && 
                            !b.innerText.includes('Connect Wallet') && !b.innerText.includes('Max')
                        );
                        if (mainBtn) mainBtn.click();
                    }
                }, side);

                // Wait for and approve Phantom popup
                const approved = await approveConnection(page.context() as any);
                if (approved) {
                    logger.info(`[Interaction] Wallet window appeared and was approved successfully.`);
                    popupApproved = true;
                    break;
                }

                logger.info(`[Interaction] Attempt ${i} failed (Wallet did not show or was blank). Retrying click...`);
                await page.waitForTimeout(2000);
            }

            if (!popupApproved) {
                throw new Error(`Execution failed: Phantom wallet window did not appear correctly after 5 click attempts.`);
            }

            // --- PHASE 4: PROOF OF EXISTENCE VERIFICATION ---
            logger.info('Transaction approved. Waiting for position to appear in Jupiter console...');
            const startTime = Date.now();
            const timeoutThreshold = 60000;
            let positionVerified = false;

            while (Date.now() - startTime < timeoutThreshold) {
                const currentCount = await countPositions(page);
                if (currentCount > initialCount) {
                    logger.info(`[Verification] SUCCESS! Position confirmed in Jupiter UI (Count: ${currentCount} > ${initialCount})`);
                    positionVerified = true;
                    break;
                }

                // Also check for specific "Confirmed" toasts as secondary proof
                const toastConfirmed = await page.evaluate(() => {
                    const text = document.body.innerText;
                    return text.includes('Transaction Confirmed') || text.includes('Position Opened');
                });

                if (toastConfirmed) {
                    logger.info(`[Verification] SUCCESS! Verified via confirmation toast.`);
                    positionVerified = true;
                    break;
                }

                await page.waitForTimeout(3000);
            }

            if (!positionVerified) {
                throw new Error('Verification failed: Trade approved in wallet but never appeared in Jupiter Positions list after 60s.');
            }

            logger.info(`[openPosition] Trade completed and verified successfully.`);
            reportSuccess();
            success = true;
        } catch (err) {
            reportFailure();
            throw err;
        } finally {
            isTradeInProgress = false;
        }
    });

    if (success) {
        runBalanceUpdate(page).catch(() => {});
    }
};

export const closePosition = async (page: Page) => {
    let success = false;
    await withPageLock(async () => {
        isTradeInProgress = true;
        try {
            const initialCount = await countPositions(page);
            logger.info(`Attempting to close all positions (currently ${initialCount})...`);

            if (initialCount === 0) {
                logger.info('No open positions to close. Nothing to do.');
                success = true;
                return;
            }

            const closeAllButton = page.getByText('Close All', { exact: true }).first();
            if (await closeAllButton.isVisible()) {
                await closeAllButton.click();
                logger.info('Close All clicked. Checking for confirmation modal...');
                await page.waitForTimeout(1000);
                
                // If there's a modal, find a button inside that has "Confirm", "Close", or "Close All"
                const modalBtnClicked = await page.evaluate(() => {
                    const dialogs = Array.from(document.querySelectorAll('div[role="dialog"], [class*="modal"]'));
                    if (dialogs.length === 0) return false;
                    for (const dialog of dialogs) {
                        const buttons = Array.from(dialog.querySelectorAll('button'));
                        const confirmBtn = buttons.find(b => {
                            const txt = (b.innerText || '').toLowerCase();
                            return txt.includes('confirm') || txt.includes('close');
                        });
                        if (confirmBtn && (confirmBtn as HTMLElement).offsetParent !== null) {
                            (confirmBtn as HTMLElement).click();
                            return true;
                        }
                    }
                    return false;
                });
                
                if (modalBtnClicked) {
                    logger.info('Confirmation modal button clicked.');
                }
                
                // Wait for and approve Phantom popup
                const approved = await approveConnection(page.context() as any);
                if (!approved) {
                    throw new Error('[closePosition] Phantom wallet did not appear / was not approved. Positions may still be open.');
                }
                logger.info(`[closePosition] Wallet approved. Verifying positions actually closed...`);

                // --- PROOF OF CLOSURE: confirm the position count drops ---
                const startTime = Date.now();
                const timeoutThreshold = 60000;
                let closed = false;
                while (Date.now() - startTime < timeoutThreshold) {
                    const currentCount = await countPositions(page);
                    if (currentCount < initialCount) {
                        logger.info(`[closePosition] SUCCESS: positions ${initialCount} -> ${currentCount}.`);
                        closed = true;
                        break;
                    }
                    await page.waitForTimeout(3000);
                }

                if (!closed) {
                    throw new Error('[closePosition] Approved in wallet but position count never decreased after 60s. Positions may still be open.');
                }
                reportSuccess();
                success = true;
            } else {
                logger.info('No "Close All" button found despite open positions.');
                throw new Error('[closePosition] "Close All" button not found while positions are open.');
            }
        } catch (e: any) {
            logger.error(`[closePosition] Error closing positions: ${e.message}`);
            reportFailure();
            throw e;
        } finally {
            isTradeInProgress = false;
        }
    });

    if (success) {
        logger.info('[closePosition] Scheduling balance update in 5 seconds...');
        setTimeout(() => {
            runBalanceUpdate(page).catch(() => {});
        }, 5000);
    }
};

export const isWalletConnected = async (page: Page): Promise<boolean> => {
    return await page.evaluate(() => {
        const textElements = Array.from(document.querySelectorAll('button, span, div'));
        const addressPattern = /[a-zA-Z0-9]{2,}\.{2,}[a-zA-Z0-9]{2,}/;
        return textElements.some(e => {
            const text = (e as HTMLElement).innerText?.trim();
            return text && addressPattern.test(text);
        });
    });
};


export const getTradeEstimation = async (page: Page, side: 'long' | 'short', amount: number, asset: string | undefined, leverage: number) => {
    return withPageLock(async () => {
        isTradeInProgress = true;
        try {
            await page.bringToFront();
        
        // 0. Select Side (Long/Short)
        const tabName = side === 'long' ? 'Long/Buy' : 'Short/Sell';
        await page.getByText(tabName, { exact: true }).first().click({ force: true });
        await page.waitForTimeout(500);

        // -1. Select Asset (SOL, ETH, WBTC) if provided
        if (asset) {
            logger.info(`Selecting asset tab: ${asset}...`);
            const assetTab = page.getByRole('button').filter({ hasText: new RegExp(`^${asset}$`, 'i') }).first();
            if (await assetTab.isVisible({ timeout: 2000 }).catch(() => false)) {
                await assetTab.click({ force: true });
                await page.waitForTimeout(1000); 
            } else {
                const fallbackTab = page.getByText(asset, { exact: true }).first();
                if (await fallbackTab.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await fallbackTab.click({ force: true });
                    await page.waitForTimeout(1000);
                } else {
                    console.warn(`Asset ${asset} tab not found. Proceeding with currently selected asset.`);
                }
            }
        }

        // 1. Switch to USDC
        const amountInput = page.getByPlaceholder('0.00').filter({ hasNotText: 'x' }).first();

        // Wait for the input to be EDITABLE (not just visible).
        // Jupiter disables the input while the wallet is connecting/loading.
        // Playwright 'editable' state = visible + enabled + not readonly.
        let inputEditable = await amountInput.waitFor({ state: 'visible', timeout: 5000 }).then(async () => {
            // Extra check: wait for not-disabled
            for (let i = 0; i < 30; i++) {
                const isDisabled = await amountInput.isDisabled().catch(() => true);
                if (!isDisabled) return true;
                logger.info(`[getTradeEstimation] Input disabled (wallet loading?), waiting... (${i + 1}/30)`);
                await page.waitForTimeout(500);
            }
            return false;
        }).catch(() => false);

        if (!inputEditable) {
            logger.warn('[getTradeEstimation] Input still disabled after 15s. Attempting wallet reconnect...');
            await connectWalletInternal(page).catch(() => {});
            await page.waitForTimeout(3000);
            // Final check
            inputEditable = !(await amountInput.isDisabled().catch(() => true));
            if (!inputEditable) {
                throw new Error('[getTradeEstimation] Input not editable after wallet reconnect. Wallet may be disconnected.');
            }
        }

        // Selector strategy: Input -> Grandparent -> Button
        const tokenSelector = amountInput.locator('xpath=../..').locator('button').first();
        const currentToken = await tokenSelector.innerText().catch(() => '');

        if (!currentToken.includes('USDC')) {
            logger.info('Switching token to USDC...');
            await tokenSelector.click();
            await page.waitForTimeout(500);
            const usdcOption = page.locator('div[role="dialog"]').getByText('USDC', { exact: true }).first();
            if (await usdcOption.isVisible()) {
                await usdcOption.click();
            } else {
                const usdcGeneric = page.locator('div[role="dialog"]').getByText('USD Coin').first();
                if (await usdcGeneric.isVisible()) await usdcGeneric.click();
            }
            await page.waitForTimeout(1000);
        }

        // 2. Set Amount
        await amountInput.fill(amount.toString());

        // 3. Set Leverage
        const leverageInput = page.locator('input.text-center').first();
        if (await leverageInput.isVisible({ timeout: 3000 }).catch(() => false)) {
            await leverageInput.fill(leverage.toString());
            await leverageInput.press('Enter');
            await page.waitForTimeout(1000);
        } else {
            logger.warn('[getTradeEstimation] Leverage input not visible. Skipping leverage set.');
        }

        // 4. Set Slippage (SKIPPED per user request - usage of manual setting from UI)
        logger.info('Skipping automated slippage setting. Using UI default.');
        await page.waitForTimeout(1000); // Wait for simulatio        // 5. Read Values
        // Using STRING evaluation to 100% prevent transpiler from injecting helper variables like __name
        const evalCode = `
            (function() {
                const result = {};
                const getText = (label) => {
                    const allEls = Array.from(document.querySelectorAll('span, div, p, td'));
                    
                    // 1. Try finding an exact match of the label first
                    const labelEl = allEls.find(e => e.innerText?.trim() === label);
                    if (labelEl) {
                        // Check next sibling (common in React Flex layouts)
                        const next = labelEl.nextElementSibling;
                        if (next && next.innerText?.trim()) return next.innerText.trim();
                        
                        // Check parent/ancestor container and replace the label
                        const container = labelEl.closest('div');
                        if (container) {
                            const cleanText = container.innerText.replace(label, '').trim();
                            if (cleanText) return cleanText;
                        }
                    }
                    
                    // 2. Try matching any element that starts with or contains the label
                    const containerEl = allEls.find(e => {
                        const t = e.innerText?.trim() || '';
                        return t.startsWith(label) && t !== label && t.length < label.length + 30;
                    });
                    if (containerEl) {
                        return containerEl.innerText.replace(label, '').trim().split(String.fromCharCode(10)).join(' ');
                    }
                    
                    return '-';
                };
                
                result.entryPrice = getText('Entry Price');
                result.liquidationPrice = getText('Liquidation Price');
                
                // Strict Slippage Extraction
                const allDivs = Array.from(document.querySelectorAll('div, span, button'));
                const slipEl = allDivs.find(e => {
                    const t = e.innerText?.trim();
                    return t && t.startsWith('Max:') && t.includes('%') && t.length < 20;
                });
                result.slippage = slipEl ? slipEl.innerText : 'Max: 2%';
                
                // Total Fees Extraction
                const feeLabel = Array.from(document.querySelectorAll('span, div, p')).find(e => {
                    const t = e.innerText?.trim() || '';
                    return t === 'Total Fees' || t.startsWith('Total Fees');
                });
                if (feeLabel) {
                    const container = feeLabel.closest('div');
                    if (container) {
                        const txt = container.innerText || '';
                        const rx = new RegExp('(?:\\\\u2248\\\\s*)?[0-9.]+\\\\s*(?:USD|USDC|SOL|JUP)', 'i');
                        const match = rx.exec(txt);
                        if (match) {
                            result.totalFees = match[0];
                        } else {
                            result.totalFees = txt.replace('Total Fees', '').replace('borrow fees due:-', '').trim().split(String.fromCharCode(10)).join(' ');
                        }
                    }
                }
                
                return JSON.stringify(result);
            })()
        `;
        logger.info(`[getTradeEstimation] Evaluating code in browser:\n${evalCode}`);
        const resultString = await page.evaluate(evalCode);

        const parsed = JSON.parse(resultString as string);

        // Calculate break-even price
        try {
            const entryStr = parsed.entryPrice?.replace(/,/g, '').match(/[\d.]+/);
            const feeStr = parsed.totalFees?.replace(/,/g, '').match(/[\d.]+/);

            if (entryStr && feeStr && amount > 0 && leverage > 0) {
                const entry = parseFloat(entryStr[0]);
                let fee = parseFloat(feeStr[0]);

                // If fee is in SOL, convert broadly to USD using entry price
                if (parsed.totalFees?.includes('SOL') && !parsed.totalFees?.includes('USD') && !parsed.totalFees?.includes('USDC')) {
                    fee = fee * entry;
                }

                const positionUsd = amount * leverage;
                // Double the fee to account for closing the position roughly
                const totalEstimatedFeesUsd = fee * 2;

                // Price movement required to cover the fees
                const priceDelta = (totalEstimatedFeesUsd * entry) / positionUsd;

                if (side === 'long') {
                    parsed.breakEvenPrice = (entry + priceDelta).toFixed(4);
                } else {
                    parsed.breakEvenPrice = (entry - priceDelta).toFixed(4);
                }
            }
        } catch (calcErr) {
            console.error('Error calculating break-even:', calcErr);
        }

        return parsed;

    } catch (e: any) {
        console.error('Estimate error:', e);
        return { error: e.message };
        } finally {
            isTradeInProgress = false;
        }
    });
};
export const getOpenPositions = async (page: Page): Promise<any[]> => {
    return withPageLock(async () => {
        // 1. Ensure we are on the "Positions" tab
    const debugInfo = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, div[role="button"]')) as HTMLElement[];
        const tabs = buttons.map(b => ({
            text: (b.innerText || '').trim(),
            className: b.className,
            opacity: window.getComputedStyle(b).opacity,
            isActive: !b.className.includes('text-v2-lily/50') && window.getComputedStyle(b).opacity === '1'
        })).filter(b => b.text.includes('Positions') || b.text.includes('History'));
        
        const positionsTab = buttons.find(el => (el.innerText || '').trim().startsWith('Positions'));
        
        if (positionsTab) {
            // Active tab is 'text-v2-lily', inactive is 'text-v2-lily/25' or 'text-v2-lily/50'
            const isInactive = positionsTab.className.includes('/');
            
            if (isInactive) {
                (positionsTab as HTMLElement).click();
                return { tabSwitched: true, tabs };
            }
        }
        return { tabSwitched: false, tabs };
    });

    if (debugInfo.tabSwitched) {
        logger.info(`[getOpenPositions] Tab was inactive (Detected /). Switching...`);
        await page.waitForTimeout(1000);
    }

    const result = await page.evaluate(`
        (function() {
            try {
                // === REAL DOM STRUCTURE (from live inspection) ===
                // Position cards have class: "flex flex-col space-y-5 border-t border-v2-lily/5 pt-4 first:border-none"
                // Each card's innerText looks like:
                // "WBTC\\n49.93x Long\\nPNL (In. open/close/borrow fees)\\n-$2.50 (-7.39%)\\nValue\\n$31.29\\nEntry Price\\n$77,146.12\\nMark Price\\n$77,124.70\\nLiq. Price\\n$75,809.68\\nSize\\n$1,687.12\\n0.02186912 WBTC\\nCollateral\\n$33.79\\n..."

                const cards = Array.from(document.querySelectorAll('div.flex.flex-col.space-y-5'));
                const positionCards = cards.filter(el => {
                    const t = el.innerText || '';
                    return (t.includes('Entry Price') || t.includes('Liq. Price')) && 
                           (t.includes('Long') || t.includes('Short')) &&
                           t.length < 1000;
                });

                if (positionCards.length === 0) {
                    // Check if simply no positions
                    const body = document.body.innerText || '';
                    if (body.includes('No open positions')) return JSON.stringify({ positions: [] });
                    return JSON.stringify({ positions: [], error: 'No position cards matched' });
                }

                const positions = positionCards.map((card, i) => {
                    const t = (card.innerText || '').replace(/\\n/g, ' ').trim();
                    
                    const getMatch = (regex) => {
                        const m = t.match(regex);
                        return m ? m[1].trim() : null;
                    };

                    // Extract core data using regex patterns
                    const asset = t.match(/^([A-Z]+)/)?.[1] || 'Unknown';
                    const leverageSide = t.match(/([0-9.]+x (?:Long|Short))/)?.[1] || 'Unknown';
                    const pnl = getMatch(/PNL \\(.*?\\)(.*?)(?:Value|$)/);
                    const value = getMatch(/Value(.*?)(?:Entry Price|$)/);
                    const entryPrice = getMatch(/Entry Price(.*?)(?:Mark Price|$)/);
                    const markPrice = getMatch(/Mark Price(.*?)(?:Liq\\. Price|$)/);
                    const liqPrice = getMatch(/Liq\\. Price(.*?)(?:Size|$)/);
                    const size = getMatch(/Size(.*?)(?:Collateral|$)/);
                    const collateral = getMatch(/Collateral(.*?)(?:Take Profit|$)/);
                    
                    // Simple logic for side and leverage
                    const side = leverageSide.toLowerCase().includes('short') ? 'short' : 'long';
                    const leverage = leverageSide.split(' ')[0] || null;

                    return {
                        index: i,
                        asset,
                        side,
                        leverage,
                        pnl,
                        value,
                        entryPrice,
                        markPrice,
                        liqPrice,
                        size,
                        collateral,
                        raw: t
                    };
                });

                return JSON.stringify({ positions });
            } catch(e) {
                return JSON.stringify({ positions: [], error: e.message });
            }
        })()
    `);

    try {
        const parsed = JSON.parse(result as string);
        return parsed.positions ?? [];
    } catch {
        return [];
    }
    });
};

/**
 * Retrieves the recent trade history from the "History" tab.
 * Switches to the tab if it's not currently active.
 */
export const getTradeHistory = async (page: Page): Promise<any[]> => {
    return withPageLock(async () => {
        logger.info('[getTradeHistory] Fetching trade history...');
    
    // Switch to the History tab first to ensure it's loaded
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, div[role="button"]')) as HTMLElement[];
        const historyTab = buttons.find(el => (el.innerText || '').trim().includes('History'));
        if (historyTab) historyTab.click();
    });
    
    // Brief wait for tab content
    await page.waitForTimeout(1000);

    const resultString = await page.evaluate(`
        (async function() {
            try {
                // 1. Verify Connection
                const bodyText = document.body.innerText || '';
                if (bodyText.includes('Connect your wallet')) return JSON.stringify({ error: 'NOT_CONNECTED' });

                // 2. Wait for data container
                const startTime = Date.now();
                let rows = [];
                let container = null;

                while (Date.now() - startTime < 4000) {
                    // Use the exact class provided by the user
                    const exactRows = Array.from(document.getElementsByClassName("flex flex-col space-y-4 border-t border-v2-lily/5 px-2 py-4 first:border-none last:border-b"));
                    
                    if (exactRows.length > 0) {
                        rows = exactRows;
                        break;
                    }
                    await new Promise(r => setTimeout(r, 200));
                }

                if (rows.length === 0) {
                    if (document.body.innerText.includes('No history found')) return JSON.stringify({ history: [] });
                    return JSON.stringify({ error: 'Timeout waiting for history rows with exact class' });
                }

                // 3. Extract and Parse Data using Regex to split concatenated fields
                const history = rows.map((row, i) => {
                    const t = (row.innerText || '').replace(/\\n/g, ' ').trim();
                    
                    // Simple regex pattern to capture values between headers
                    // Example: "WBTCIncrease ShortOrder TypeMarketSize$1,447.22Price$76,232.06..."
                    const getMatch = (regex) => {
                        const m = t.match(regex);
                        return m ? m[1].trim() : '-';
                    };

                    const asset = t.match(/^([A-Z]+)/)?.[1] || 'Unknown';
                    const action = t.match(/[A-Z]+(Increase [a-zA-Z]+|Decrease [a-zA-Z]+|Close [a-zA-Z]+|Swap)/)?.[1] || 'Unknown';
                    const orderType = getMatch(/Order Type(.*?)(?:Size|$)/);
                    const size = getMatch(/Size(.*?)(?:Price|$)/);
                    const price = getMatch(/Price(.*?)(?:Deposit\\/Withdraw|$)/);
                    const depositWithdraw = getMatch(/Deposit\\/Withdraw(.*?)(?:PnL|$)/);
                    const pnl = getMatch(/PnL(?:\\(.*?\\))?(.*?)(?:Fee|$)/);
                    const fee = getMatch(/Fee(.*?)([0-9]{1,2}:[0-9]{2} .*|$)/);
                    const time = t.match(/([0-9]{1,2}:[0-9]{2} [0-9]{2}\\/[0-9]{2}\\/[0-9]{4} .*)$/)?.[1] || 'Unknown';

                    return {
                        index: i,
                        asset,
                        action,
                        orderType,
                        size,
                        price,
                        depositWithdraw,
                        pnl,
                        fee,
                        time,
                        raw: t
                    };
                });

                return JSON.stringify({ history });
            } catch (e) {
                return JSON.stringify({ error: e.message });
            }
        })()
    `);

    try {
        const parsed = JSON.parse(resultString as string);
        if (parsed.error) {
            logger.warn(`[getTradeHistory] Info: ${parsed.error}`);
            if (parsed.error === 'NOT_CONNECTED') return parsed;
            return [];
        }
        return parsed.history ?? [];
    } catch (e) {
        logger.error('[getTradeHistory] Unexpected error:', e);
        return [];
    }
    });
};
/**
 * Retrieves the current positions container inner HTML for debugging.
 */
export const getTradeHtml = async (page: Page): Promise<string> => {
    return withPageLock(async () => {
        return await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('button, span')).filter(e => (e as HTMLElement).innerText?.includes('Positions'));
            const container = tabs[0]?.closest('div')?.parentElement?.parentElement;
            return container ? container.innerHTML : "POSITIONS_CONTAINER_NOT_FOUND";
        });
    });
};

/**
 * Returns the currently connected wallet name.
 */
export const getWalletName = async (page: Page): Promise<string> => {
    return withPageLock(async () => {
        return await page.evaluate(() => {
            // 1. BEST WAY: Directly from the injected solana object
            // @ts-ignore
            if (window.solana && window.solana.publicKey) {
                // @ts-ignore
                return window.solana.publicKey.toString();
            }

            // 2. FALLBACK: Scrape from UI
            const buttons = Array.from(document.querySelectorAll('button'));
            const walletBtn = buttons.find(b => {
                const t = (b.innerText || "").trim();
                if (t.length < 5 || t.length > 25) return false;
                if (t.toLowerCase().includes('connect')) return false;
                if (t === 'More' || t === 'Trade' || t === 'Limits') return false;
                if (t.includes('..')) return true;
                return /^[a-zA-Z0-9]+$/.test(t) && /[0-9]/.test(t) && /[a-zA-Z]/.test(t);
            });
            return walletBtn ? walletBtn.innerText.trim() : "Not Connected";
        }).catch(() => "Unknown");
    });
};

/**
 * Updates a position's TP/SL levels.
 */
export const updatePosition = async (page: Page, asset: string, options: { stopLoss?: number; takeProfit?: number }) => {
    let success = false;
    await withPageLock(async () => {
        logger.info(`[updatePosition] Starting update for ${asset}...`);
    const symbol = asset.toUpperCase().trim();

    // 1. Find the target position card with retries for loading
    let findingResult: any = { error: 'Initialization' };
    for (let attempts = 0; attempts < 5; attempts++) {
        findingResult = await page.evaluate((sym) => {
            // Find all possible asset name elements
            const elements = Array.from(document.querySelectorAll('span, div, p'));
            const assetEl = elements.find(el => {
                const text = (el as HTMLElement).innerText?.trim();
                return text === sym || text === `${sym}-USDC` || text === `${sym}-SOL`;
            });
            
            if (!assetEl) {
                // Log what we DO see for debugging
                const allTexts = elements.map(e => (e as HTMLElement).innerText?.trim() || '').filter(t => t.length > 2 && t.length < 20).slice(0, 50);
                return { error: `Asset ${sym} not found. Examples found: ${allTexts.join(', ')}` };
            }
            
            // Try to find the row container.
            let row = assetEl.parentElement;
            while (row && row.tagName !== 'BODY') {
                const text = (row.innerText || '').toUpperCase();
                // A position row typically contains SIZE and ENTRY PRICE or LIQ. PRICE
                if (text.includes('SIZE') && text.includes('ENTRY PRICE')) {
                    break;
                }
                row = row.parentElement;
            }

            if (!row || row.tagName === 'BODY') return { error: `Could not determine row container for ${sym}` };
            
            // Let's mark it temporarily or find a reliable selector relative to it
            row.setAttribute('data-target-position', 'true');
            return { success: true };
        }, symbol);

        if (findingResult.success) break;
        await page.waitForTimeout(2000);
        logger.info(`[updatePosition] Asset ${symbol} not found yet. Retrying... (${attempts + 1}/5)`);
    }

    if (findingResult.error) {
        throw new Error(`[updatePosition] ${findingResult.error}`);
    }

    const performUpdate = async (type: 'stopLoss' | 'takeProfit', value: number) => {
        const label = type === 'stopLoss' ? 'Stop Loss' : 'Take Profit';
        logger.info(`[updatePosition] Updating ${label} to ${value}...`);

        // Click the specific pencil icon within the marked row
        const pencilFound = await page.evaluate((lbl) => {
            const row = document.querySelector('[data-target-position="true"]');
            if (!row) return false;

            // Search for the specific label span class based on TP/SL color coding
            const targetClass = lbl.includes('Take Profit') ? 'text-v3-text-perps-green' : 'text-v3-perps-red';
            const spans = Array.from(row.querySelectorAll('span'));
            const targetSpans = spans.filter(s => s.className.includes(targetClass));
            
            for (const span of targetSpans) {
                // Ignore spans hidden by media queries (e.g. mobile view when on desktop)
                if ((span as HTMLElement).offsetWidth === 0) continue;

                // In Jupiter's DOM, the button is a sibling inside the same parent flex container
                const parent = span.parentElement;
                if (parent) {
                    const btn = parent.querySelector('button.fill-current');
                    if (btn && (btn as HTMLElement).offsetWidth > 0) {
                        btn.id = 'temp-target-pencil';
                        return true;
                    }
                }
            }
            return false;
        }, label);

        if (!pencilFound) {
             throw new Error(`Could not find the ${label} pencil icon for the position.`);
        }

        // Dispatch click directly bypassing strict bounding/opacity checks
        await page.locator('#temp-target-pencil').dispatchEvent('click');
        
        // Cleanup ID
        await page.evaluate(() => {
             const p = document.getElementById('temp-target-pencil');
             if (p) p.removeAttribute('id');
        });

        await page.waitForTimeout(2000); // Wait for modal

        // Interactions in the Modal/Inline Popup
        // The popup is not a full-page modal, but an inline component with a "Confirm" button
        const domResult = await page.evaluate(() => {
            const confirmBtns = Array.from(document.querySelectorAll('button')).filter(b => {
                const text = b.innerText || '';
                return (text.includes('Confirm') || text.includes('Update')) && b.offsetWidth > 40;
            });
            
            // Take the last/latest visible Confirm button
            const activeConfirmBtn = confirmBtns.pop();
            if (!activeConfirmBtn) return { success: false, error: 'No Confirm or Update button found.' };
            
            activeConfirmBtn.id = 'active-submit-btn';
            
            // Traverse up the DOM to find the container that holds both the button and the input
            let container = activeConfirmBtn.parentElement;
            let inputs: HTMLInputElement[] = [];
            for (let i = 0; i < 8; i++) { // Go up to 8 levels looking for the panel
                if (container) {
                    inputs = Array.from(container.querySelectorAll('input'));
                    if (inputs.length > 0) break;
                    container = container.parentElement;
                } else break;
            }

            const firstInput = inputs[0];
            if (inputs.length > 0 && firstInput) {
                // The first input is usually the price
                firstInput.id = 'active-modal-input';
                return { success: true };
            }

            return { success: false, error: 'No input found in the vicinity of the Confirm button.' };
        });

        if (!domResult.success) {
            throw new Error(`[updatePosition] failed in modal DOM extraction: ${domResult.error}`);
        }
        
        // Clear and fill
        const inputLocator = page.locator('#active-modal-input');
        await inputLocator.click({force: true}).catch(()=>{});
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await inputLocator.fill(value.toString(), {force: true});
        await page.waitForTimeout(1000);

        // Click the confirm/update button
        await page.locator('#active-submit-btn').click();

        // Cleanup
        await page.evaluate(() => {
            const d = document.getElementById('active-modal-dialog');
            if (d) d.removeAttribute('id');
            const i = document.getElementById('active-modal-input');
            if (i) i.removeAttribute('id');
            const b = document.getElementById('active-submit-btn');
            if (b) b.removeAttribute('id');
        });

        // Approve with wallet
        logger.info(`[updatePosition] Approving ${label} update in wallet...`);
        const approved = await approveConnection(page.context() as any);
        if (!approved) throw new Error(`Wallet approval failed for ${label} update.`);

        // Wait for modal to close
        await page.waitForTimeout(3000);
        logger.info(`[updatePosition] ${label} update submitted.`);
    };

    // Sequential Execution
    if (options.takeProfit) {
        await performUpdate('takeProfit', options.takeProfit);
    }

        if (options.stopLoss) {
            await performUpdate('stopLoss', options.stopLoss);
        }

        logger.info(`[updatePosition] Update sequence for ${symbol} completed.`);
        success = true;
    });

    if (success) {
        logger.info('[updatePosition] Scheduling balance update in 5 seconds...');
        setTimeout(() => {
            runBalanceUpdate(page).catch(() => {});
        }, 5000);
    }
};
