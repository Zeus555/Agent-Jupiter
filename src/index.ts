import express from 'express';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getPage, closeBrowser, getBrowserContext, setWindowVisibility, getBrowserPid, getCachedPageUrl, resetProfile } from './browser.js';
import { connectWallet, openPosition, closePosition, getPrice, isPageReady, getTradeEstimation, getBalances, getBalanceMeta, getPriceMeta, getOpenPositions, getTradeHistory, getTradeHtml, updatePosition, startBalanceUpdates, startPriceWarmer, getWalletName, setMaintenanceMode, isMaintenance } from './jupiter.js';
import { unlockWallet, getWalletAddressFromPhantom, getSavedWalletAddress, importWallet } from './phantom.js';
import { startVncSession, stopVncSession, isVncActive } from './vnc.js';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';
import { exec, execSync } from 'child_process';
import { logger } from './logger.js';

dotenv.config();
const port = process.env.PORT || 3011;

let cachedWalletAddress: string | null = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- ERROR HANDLING: CATCH UNEXPECTED CRASHES ---
// Unhandled rejections are common with Playwright (popups closing, background
// timeouts) and rarely mean the process is unrecoverable. Killing the process here
// risked tearing down between a wallet approval and its verification — leaving a real
// trade executed but reported as an error. So we log and keep running; only a truly
// uncaught *exception* exits (and pm2 restarts us).
process.on('unhandledRejection', (reason, promise) => {
    logger.error('[unhandledRejection] reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught Exception:', err);
    process.exit(1);
});

// --- SELF-HEALING: PORT & PROCESS CLEANUP ---
const cleanupEnvironment = async () => {
    // This whole routine clears orphaned Windows processes (netstat/taskkill/Get-CimInstance).
    // In a Linux container the process is isolated and starts clean, so there is nothing to
    // sweep — skip it entirely rather than running Windows-only commands that don't exist.
    if (process.platform !== 'win32') {
        logger.info('--- SYSTEM CLEANUP: skipped (containerized/non-Windows) ---');
        return;
    }
    logger.info('--- SYSTEM CLEANUP: ENSURING FRESH ENVIRONMENT ---');
    const portToClear = Number(port);
    const currentPid = process.pid;
    const parentPid = process.ppid;

    try {
        logger.info(`Checking port ${portToClear} (My PID: ${currentPid}, Parent PID: ${parentPid})...`);
        for (let i = 0; i < 3; i++) {
            try {
                const netstatOutput = execSync(`netstat -ano | findstr :${portToClear}`, { timeout: 8000 }).toString();
                const lines = netstatOutput.split('\n');
                for (const line of lines) {
                    if (line.includes('LISTENING')) {
                        const parts = line.trim().split(/\s+/);
                        const pidStr = parts[parts.length - 1];
                        if (pidStr) {
                            const pid = parseInt(pidStr);
                            if (pid && pid !== currentPid && pid !== parentPid) {
                                logger.info(`Found orphan process ${pid} on port ${portToClear}. Cleaning up...`);
                                try { execSync(`taskkill /F /PID ${pid} /T`); } catch (err) { }
                            }
                        }
                    }
                }
            } catch (err) { break; }
            await new Promise(r => setTimeout(r, 1000));
        }

        logger.info('Cleanup: Removing orphaned browser instances...');
        // Match by our actual user_data dir (works regardless of the install folder name).
        // The previous filter hardcoded "PRC Agent Jupiter", which never matched on the
        // server (folder is "prc-agent-jupiter"), so this cleanup silently did nothing.
        const userDataDir = path.resolve(__dirname, '../user_data').replace(/\\/g, '\\\\');
        const psCommand = `Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' OR Name = 'msedge.exe'" | Where-Object { $_.CommandLine -like '*${userDataDir}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`;
        try {
            // Timeout guards against a cold/slow WMI after a reboot hanging startup forever
            // (this routine runs before app.listen, so a hang means the API never comes up).
            execSync(`powershell -ExecutionPolicy Bypass -Command "${psCommand}"`, { stdio: 'ignore', timeout: 10000 });
        } catch (e) { }
        
    } catch (e: any) {
        logger.warn('[CLEANUP WARNING] Non-critical cleanup error:', e.message);
    }
    logger.info('--- CLEANUP COMPLETE ---');
};

await cleanupEnvironment();

const app = express();

// Permissive CORS so browser clients on the LAN — notably the Swagger UI "Try it out" —
// can call the API. The protected endpoints send a custom X-API-Key header, which makes the
// browser fire a CORS preflight (OPTIONS) first; without these headers the browser blocks the
// real request and Swagger shows a misleading "Failed to fetch" even though the request is fine
// (curl works, because curl never preflights). Reflects the request origin and answers OPTIONS.
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Accept');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

app.use(express.json());

// Debug/exploratory endpoints are disabled unless AGENT_DEBUG=true so they aren't
// exposed in production (they dump DOM, take screenshots, and click around the UI).
const requireDebug = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (process.env.AGENT_DEBUG === 'true') return next();
    return res.status(404).json({ error: 'Not found' });
};

// Wallet-management endpoints handle the recovery phrase, so they require an API key
// (X-API-Key header matching WALLET_API_KEY in .env). Fail closed: if no key is configured
// on the server, these endpoints are rejected entirely.
const requireWalletKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const expected = process.env.WALLET_API_KEY;
    if (!expected) return res.status(503).json({ error: 'Wallet management is disabled: set WALLET_API_KEY in .env to enable it.' });
    const got = req.header('X-API-Key');
    if (!got || got !== expected) return res.status(401).json({ error: 'Unauthorized: missing or invalid X-API-Key.' });
    return next();
};

// Create a simple custom JS route to serve the clipboard function for Swagger UI
app.get('/swagger-custom.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
        setInterval(() => {
            const preBlocks = document.querySelectorAll(
                '.opblock-description-wrapper pre, .description pre, .opblock-description pre, pre.example, pre.microlight, pre.example.microlight'
            );
            preBlocks.forEach(pre => {
                if (pre.innerText.includes('curl ') && !pre.getAttribute('data-has-click-listener')) {
                    pre.setAttribute('data-has-click-listener', 'true');
                    pre.style.cssText += 'cursor:pointer !important;';
                    pre.title = 'Click to copy command';

                    pre.onclick = (e) => {
                        const code = pre.querySelector('code');
                        const cmdText = (code ? code.innerText : pre.innerText).trim();
                        const x = e.clientX;
                        const y = e.clientY;

                        const showNotif = () => {
                            const notif = document.createElement('div');
                            notif.innerText = '✅ ¡Copiado!';
                            notif.style.cssText = 'position:fixed;left:' + x + 'px;top:' + (y - 30) + 'px;background:#49cc90;color:#fff;padding:4px 12px;border-radius:4px;font-size:13px;font-weight:bold;box-shadow:0 2px 10px rgba(0,0,0,0.3);z-index:99999;transition:opacity 0.5s,transform 0.5s;pointer-events:none;';
                            document.body.appendChild(notif);
                            setTimeout(() => {
                                notif.style.opacity = '0';
                                notif.style.transform = 'translateY(-10px)';
                                setTimeout(() => notif.remove(), 500);
                            }, 1200);
                            pre.style.outline = '2px solid #49cc90';
                            setTimeout(() => { pre.style.outline = ''; }, 300);
                        };

                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(cmdText).then(showNotif).catch(() => {
                                const ta = document.createElement('textarea');
                                ta.value = cmdText;
                                ta.style.position = 'fixed';
                                ta.style.opacity = '0';
                                document.body.appendChild(ta);
                                ta.select();
                                document.execCommand('copy');
                                document.body.removeChild(ta);
                                showNotif();
                            });
                        } else {
                            const ta = document.createElement('textarea');
                            ta.value = cmdText;
                            ta.style.position = 'fixed';
                            ta.style.opacity = '0';
                            document.body.appendChild(ta);
                            ta.select();
                            document.execCommand('copy');
                            document.body.removeChild(ta);
                            showNotif();
                        }
                    };
                }
            });
        }, 800);
    `);
});

// Swagger Documentation
try {
    const swaggerDocument = yaml.load(fs.readFileSync(path.resolve('swagger.yaml'), 'utf8')) as any;
    const customCss = `
        .opblock-description-wrapper pre, .description pre, .opblock-description pre { position: relative; background: #333 !important; padding: 12px !important; border-radius: 4px; overflow: visible !important; }
        .opblock-description-wrapper pre code, .description pre code, .opblock-description pre code { color: #a6e22e !important; background: transparent !important; transition: background 0.2s; border-radius: 2px; }
        .opblock-description-wrapper pre code:hover, .description pre code:hover, .opblock-description pre code:hover { background: rgba(255, 255, 255, 0.05) !important; cursor: pointer !important; }
    `;
    
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
        customCss: customCss,
        customJs: '/swagger-custom.js'
    }));
    logger.force(`Swagger docs available at http://localhost:${port}/api-docs`);
} catch (e) {
    console.error('Failed to load swagger.yaml:', e);
}

// Lightweight liveness/health probe. Reports cache freshness without touching the
// browser. Pass ?deep=true to also verify the Jupiter page is actually ready (uses
// the page lock, so slightly heavier).
app.get('/health', async (req, res) => {
    const start = Date.now();
    const priceMeta = getPriceMeta();
    const balanceMeta = getBalanceMeta();

    let pageReady: boolean | null = null;
    if (req.query.deep === 'true') {
        try {
            const page = await getPage('https://jup.ag/perps', isPageReady);
            pageReady = await isPageReady(page);
        } catch {
            pageReady = false;
        }
    }

    // Healthy if the warmer is running and at least one fresh price exists.
    const hasFreshPrice = Object.values(priceMeta.prices).some(p => p.ageMs < 15000);
    const ok = priceMeta.warmerRunning && (req.query.deep !== 'true' || pageReady === true);

    res.status(ok ? 200 : 503).json({
        status: ok ? 'ok' : 'degraded',
        version: VERSION,
        uptimeSec: Math.round(process.uptime()),
        pageReady,
        pageUrl: getCachedPageUrl('https://jup.ag/perps'),
        price: { ...priceMeta, hasFreshPrice },
        balance: balanceMeta,
        durationMs: Date.now() - start
    });
});

// Import (and activate) an existing wallet from its recovery phrase. Replaces whatever
// wallet was previously in use — this is how you change the active wallet on demand.
app.post('/wallet/import', requireWalletKey, async (req, res) => {
    const start = Date.now();
    try {
        const { recoveryPhrase, password } = req.body || {};
        if (!recoveryPhrase || typeof recoveryPhrase !== 'string') {
            return res.status(400).json({ error: 'recoveryPhrase (string) is required.' });
        }
        const words = recoveryPhrase.trim().toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length !== 12 && words.length !== 24) {
            return res.status(400).json({ error: `recoveryPhrase must be 12 or 24 words (got ${words.length}).` });
        }
        const pw = (typeof password === 'string' && password.length >= 8) ? password : process.env.PHANTOM_PASSWORD;
        if (!pw) return res.status(400).json({ error: 'No password provided and PHANTOM_PASSWORD not set.' });

        logger.force('[wallet/import] Resetting profile and importing the requested wallet...');
        // Pause background browser activity so it doesn't close the browser mid-import.
        setMaintenanceMode(true);
        let address: string;
        try {
            await resetProfile();
            const context = await getBrowserContext();
            ({ address } = await importWallet(context, words, pw));
        } finally {
            setMaintenanceMode(false);
        }
        if (!address || address === 'Unknown') {
            return res.status(500).json({ error: 'Import ran but the wallet address could not be confirmed. Check container logs.', durationMs: Date.now() - start });
        }
        cachedWalletAddress = address;
        // Bring the agent back online for trading in the background (connect on Jupiter, warmers).
        getPage('https://jup.ag/perps', isPageReady).then(p => {
            connectWallet(p).catch(err => logger.error('[wallet/import] reconnect failed:', err.message));
            startBalanceUpdates(p).catch(() => {});
            startPriceWarmer(p);
        }).catch(() => {});

        res.json({ message: 'Wallet imported and activated', address, durationMs: Date.now() - start });
    } catch (error: any) {
        logger.error('[wallet/import] failed:', error.message);
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

// While a visual session is open, keep shrinking the Phantom popup (notification.html) so its
// content — including the bottom "Confirm/Connect" button — always fits, regardless of the
// popup window size. Phantom's popup renders tall; a CSS zoom on <html> makes it fit.
let popupFitTimer: ReturnType<typeof setInterval> | null = null;
let popupFitterLogged = false;
const maximizedPopupWins = new Set<string>();
const startPopupFitter = () => {
    if (popupFitTimer) return;
    popupFitTimer = setInterval(async () => {
        // 1. Add BOTH scrollbars to the popup so any off-screen button is reachable. MINIMAL CSS
        //    only — do NOT touch #root/heights (that blanked Phantom's render).
        try {
            const ctx = await getBrowserContext();
            const extPages = ctx.pages().filter(p => p.url().startsWith('chrome-extension://'));
            if (extPages.length && !popupFitterLogged) { popupFitterLogged = true; logger.force(`[popupFit] injecting into ${extPages.length} extension page(s)`); }
            for (const p of extPages) {
                await p.evaluate(() => {
                    let st = document.getElementById('__agent_fit') as HTMLStyleElement | null;
                    if (!st) { st = document.createElement('style'); st.id = '__agent_fit'; (document.head || document.documentElement).appendChild(st); }
                    st.textContent = `html{overflow-x:scroll !important;overflow-y:scroll !important;}`;
                }).catch(() => {});
            }
        } catch {}
        // 2. Maximize the Phantom popup to fullscreen ONCE per window — re-maximizing every tick
        //    blanked the render and fought the user's minimize. After this, leave the window alone.
        exec(`xdotool search --name "Phantom Wallet" 2>/dev/null`, (err, stdout) => {
            if (err || !stdout) return;
            for (const id of stdout.trim().split(/\s+/).filter(Boolean)) {
                if (maximizedPopupWins.has(id)) continue;
                maximizedPopupWins.add(id);
                exec(`wmctrl -i -r ${id} -b add,maximized_vert,maximized_horz 2>/dev/null`, () => {});
            }
        });
    }, 1500);
};
const stopPopupFitter = () => {
    if (popupFitTimer) { clearInterval(popupFitTimer); popupFitTimer = null; }
    popupFitterLogged = false;
    maximizedPopupWins.clear();
};

// Start a secure, on-demand VISUAL onboarding session (noVNC) so a human can create/import
// or change the wallet reliably (Phantom's onboarding doesn't render reliably headless).
// Pauses background browser activity while open. Returns a one-time-password-protected URL.
app.post('/wallet/onboard-session', requireWalletKey, async (req, res) => {
    const start = Date.now();
    try {
        await getBrowserContext(); // ensure the browser (and Xvfb display) is up
        setMaintenanceMode(true);  // pause warmer/self-healing so it doesn't disturb the manual flow
        const { webPort, password } = startVncSession();
        startPopupFitter();        // keep the Phantom popup shrunk so its buttons stay visible
        // Build the noVNC URL with a host the remote browser can actually reach. req.hostname
        // is right when called through the LAN IP, but falls back to 'localhost' if the API was
        // hit locally (e.g. curl on the server) — which would be unreachable from another machine.
        // Prefer PUBLIC_HOST, then a non-loopback req.hostname, then the known LAN IP.
        const reqHost = req.hostname;
        const host = process.env.PUBLIC_HOST
            || ((reqHost && reqHost !== 'localhost' && reqHost !== '127.0.0.1') ? reqHost : '192.168.1.91');
        const extId = process.env.PHANTOM_EXTENSION_ID || 'bfnaelmomeimhlpmgjnjophhpkkoljpa';
        res.json({
            message: 'Visual onboarding session started. Open the URL, connect with vncPassword, then in the browser create or import your wallet in Phantom. IMPORTANT: set the Phantom password equal to PHANTOM_PASSWORD in .env, and save your seed phrase. When finished, call POST /wallet/onboard-session/close.',
            url: `http://${host}:${webPort}/vnc.html?autoconnect=1&resize=remote`,
            vncPassword: password,
            phantomOnboardingUrl: `chrome-extension://${extId}/onboarding.html`,
            note: 'If Phantom renders blank, reload the page (Ctrl+R) in the remote view until it paints.',
            durationMs: Date.now() - start
        });
    } catch (error: any) {
        stopPopupFitter();
        setMaintenanceMode(false);
        stopVncSession();
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

// Close the visual onboarding session, resume normal operation, and report the active wallet.
app.post('/wallet/onboard-session/close', requireWalletKey, async (req, res) => {
    const start = Date.now();
    try {
        stopPopupFitter();
        stopVncSession();
        setMaintenanceMode(false);
        // Reconnect on Jupiter with the (newly set) wallet and resume warmers.
        let address = 'Unknown';
        try {
            const page = await getPage('https://jup.ag/perps', isPageReady);
            await connectWallet(page).catch(() => {});
            startBalanceUpdates(page).catch(() => {});
            startPriceWarmer(page);
            const name = await getWalletName(page);
            if (name && name !== 'Not Connected' && name !== 'Unknown') { address = name; cachedWalletAddress = name; }
        } catch {}
        res.json({ message: 'Session closed; agent resumed.', address, durationMs: Date.now() - start });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

// Report the active wallet and whether it's connected.
app.get('/wallet/status', async (req, res) => {
    const start = Date.now();
    try {
        const saved = cachedWalletAddress || getSavedWalletAddress();
        let connected = false;
        let address = saved;
        try {
            const page = await getPage('https://jup.ag/perps', isPageReady);
            const name = await getWalletName(page);
            if (name && name !== 'Not Connected' && name !== 'Unknown') { address = name; connected = true; }
        } catch {}
        res.json({ address: address || 'None', connected, durationMs: Date.now() - start });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

// Remove the wallet from the agent (wipes the Phantom profile). Price serving continues.
app.post('/wallet/forget', requireWalletKey, async (req, res) => {
    const start = Date.now();
    try {
        setMaintenanceMode(true);
        try { await resetProfile(); } finally { setMaintenanceMode(false); }
        cachedWalletAddress = null;
        try { fs.rmSync(path.resolve('wallet_address.txt'), { force: true }); } catch {}
        getPage('https://jup.ag/perps', isPageReady).then(p => startPriceWarmer(p)).catch(() => {});
        res.json({ message: 'Wallet removed. Import a new one with POST /wallet/import.', durationMs: Date.now() - start });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

app.post('/connect', async (req, res) => {
    const start = Date.now();
    try {
        const page = await getPage('https://jup.ag/perps', isPageReady);
        await connectWallet(page);

        // Start background tasks
        startBalanceUpdates(page).catch(err => logger.error('[Index] Failed to start balance updates:', err));
        startPriceWarmer(page);

        logger.info('Initialization complete. Agent ready.');
        res.json({ message: 'Connection initiated', durationMs: Date.now() - start });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

app.get('/wallet/balance', async (req, res) => {
    const start = Date.now();
    try {
        const tokenQuery = req.query.tokens as string;
        const tokens = tokenQuery ? tokenQuery.split(',').map(t => t.trim()) : ['SOL', 'WBTC', 'ETH', 'USDC'];
        
        // 1. Get from memory or file (VERY FAST)
        let walletName = cachedWalletAddress || getSavedWalletAddress();
        
        // 2. Fast Balance (Cache only)
        const allBalances = await getBalances(null, tokens);

        // 3. If still unknown, only then do we touch the browser (SLOW)
        if (walletName === 'Unknown') {
            logger.info('Wallet address unknown. Trying to capture from browser...');
            const page = await getPage('https://jup.ag/perps', isPageReady);
            const browserName = await getWalletName(page);
            if (browserName !== 'Not Connected' && browserName !== 'Unknown') {
                walletName = browserName;
                cachedWalletAddress = walletName;
                try {
                    fs.writeFileSync(path.resolve('wallet_address.txt'), walletName);
                    logger.info(`Persisted wallet address: ${walletName}`);
                } catch (e) {}
            }
        } else {
            cachedWalletAddress = walletName;
        }
        
        // Filter: Always keep SOL, keep others only if balance > 0
        const filteredBalances: Record<string, string> = {};
        for (const [symbol, val] of Object.entries(allBalances)) {
            const numericVal = parseFloat(val.replace(/[^\d.]/g, '')) || 0;
            if (symbol === 'SOL' || numericVal > 0) {
                filteredBalances[symbol] = val;
            }
        }
        
        const meta = getBalanceMeta();
        res.json({
            wallet: walletName,
            balances: filteredBalances,
            // Tells the consumer whether the numbers are trustworthy. `stale: true` or
            // `hasData: false` means a balance of "0" may just be an unpopulated cache.
            lastUpdated: meta.lastUpdated,
            stale: meta.stale,
            hasData: meta.hasData,
            durationMs: Date.now() - start
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

app.post('/trade/long', async (req, res) => {
    const start = Date.now();
    try {
        const { asset, amount, leverage, takeProfit, stopLoss, collateral } = req.body;
        const page = await getPage('https://jup.ag/perps', isPageReady);
        await openPosition(page, 'long', Number(amount), asset, leverage, takeProfit, stopLoss, collateral);
        res.json({ message: 'Long trade created and verified', durationMs: Date.now() - start });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

app.post('/trade/short', async (req, res) => {
    const start = Date.now();
    try {
        const { asset, amount, leverage, takeProfit, stopLoss, collateral } = req.body;
        const page = await getPage('https://jup.ag/perps', isPageReady);
        await openPosition(page, 'short', Number(amount), asset, leverage, takeProfit, stopLoss, collateral);
        res.json({ message: 'Short trade created and verified', durationMs: Date.now() - start });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

app.get('/trade/info', async (req, res) => {
    const start = Date.now();
    try {
        const page = await getPage('https://jup.ag/perps', isPageReady);
        const positions = await getOpenPositions(page);
        res.json({ count: positions.length, positions, durationMs: Date.now() - start });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

app.get('/trade/history', async (req, res) => {
    const start = Date.now();
    try {
        const page = await getPage('https://jup.ag/perps', isPageReady);
        let history = await getTradeHistory(page);
        
        // If the scraper detected no connection, force a reconnect and retry once
        if (typeof history === 'object' && !Array.isArray(history) && (history as any).error === 'NOT_CONNECTED') {
            logger.info('[trade/history] Scraper reported NOT_CONNECTED. Attempting force reconnect...');
            await connectWallet(page);
            history = await getTradeHistory(page);
        }
        
        const finalHistory = Array.isArray(history) ? history : [];
        res.json({ count: finalHistory.length, history: finalHistory, durationMs: Date.now() - start });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

// Temporary debug endpoint — dumps raw DOM info from the positions area
app.get('/trade/debug', requireDebug, async (req, res) => {
    const start = Date.now();
    try {
        const page = await getPage('https://jup.ag/perps', isPageReady);
        const raw = await page.evaluate(`
            (function() {
                const allEls = Array.from(document.querySelectorAll('span, div, p, button'));

                // Find the Positions tab
                const posTab = allEls.find(e => {
                    const t = (e.innerText || '').trim();
                    return t.startsWith('Positions') && t.length < 30;
                });

                // Walk up 5 levels and dump text
                const walk = (el, depth) => {
                    if (!el || depth > 5) return null;
                    return {
                        tag: el.tagName,
                        className: el.className,
                        textLength: (el.innerText || '').length,
                        textPreview: (el.innerText || '').substring(0, 400),
                        parent: walk(el.parentElement, depth + 1)
                    };
                };

                // Also dump ALL unique innerTexts containing "Entry Price"
                const entryEls = allEls
                    .filter(e => (e.innerText || '').includes('Entry Price') && e.innerText.length < 1500)
                    .map(e => ({
                        tag: e.tagName,
                        className: e.className,
                        textLength: (e.innerText || '').length,
                        text: (e.innerText || '').substring(0, 600)
                    }));

                return JSON.stringify({
                    posTabFound: !!posTab,
                    posTabText: posTab ? posTab.innerText : null,
                    posTabWalk: posTab ? walk(posTab, 0) : null,
                    entryPriceElements: entryEls.slice(0, 5)
                });
            })()
        `);
        res.json({ debug: JSON.parse(raw as string), durationMs: Date.now() - start });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

// Exploratory endpoint requested by user to click and capture the modal
app.get('/debug/click', requireDebug, async (req, res) => {
    const start = Date.now();
    try {
        const page = await getPage('https://jup.ag/perps', isPageReady);
        
        // Find position row and click the pencil
        const clicked = await page.evaluate(() => {
            // Looking at the exact user screenshot structure:
            // span inside basis-1/4 that contains the TP/SL values next to the button
            const spans = Array.from(document.querySelectorAll('span'));
            // Find a span that relates to TP (has text-v3-text-perps-green or similar)
            const targetSpans = spans.filter(s => s.className.includes('text-v3-text-perps-green') || s.className.includes('text-v3-perps-red'));
            
            for (const span of targetSpans) {
                const parent = span.parentElement;
                if (parent) {
                    const btn = parent.querySelector('button.fill-current');
                    if (btn) {
                        btn.id = 'debug-target-pencil';
                        return true;
                    }
                }
            }
            return false;
        });

        if (clicked) {
            await page.locator('#debug-target-pencil').click();
            await page.waitForTimeout(2000); // Wait for modal animation
            
            // Capture screenshot
            const fs = await import('fs');
            const screenPath = path.resolve(__dirname, '../../scratch/debug_modal.png');
            await page.screenshot({ path: screenPath });
            
            // Capture HTML
            const modalHtml = await page.evaluate(() => {
                const dialog = document.querySelector('div[role="dialog"], .bg-v3-modal-bg, [data-dialog]');
                return dialog ? dialog.outerHTML : "NO DIALOG IN DOM";
            });
            fs.writeFileSync(path.resolve(__dirname, '../../scratch/modal.html'), modalHtml);
            
            res.json({ message: 'Clicked and captured', screenshot: screenPath, htmlLen: modalHtml.length });
        } else {
            res.json({ message: 'Pencil not found using the strictly matched DOM structure from your screenshot' });
        }
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/trade/close', async (req, res) => {
    const start = Date.now();
    try {
        const page = await getPage('https://jup.ag/perps', isPageReady);
        await closePosition(page);
        res.json({ message: 'Close operation initiated', durationMs: Date.now() - start });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

app.post('/trade/update', async (req, res) => {
    const start = Date.now();
    try {
        const { asset, stopLoss, takeProfit } = req.body;
        if (!asset) return res.status(400).json({ error: 'Asset is required' });

        const page = await getPage('https://jup.ag/perps', isPageReady);
        
        await updatePosition(page, asset, { stopLoss, takeProfit });

        res.json({ 
            message: 'Update operation completed successfully', 
            asset,
            updates: { stopLoss, takeProfit },
            durationMs: Date.now() - start 
        });
    } catch (error: any) {
        logger.error(`[API] Trade update failed: ${error.message}`);
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

app.get('/price', async (req, res) => {
    const start = Date.now();
    try {
        const rawAsset = (req.query.asset || req.query.token || req.query.symbol || req.query.Asset);
        const asset = (Array.isArray(rawAsset) ? rawAsset[0] : rawAsset) as string || 'SOL';
        
        const page = await getPage('https://jup.ag/perps', isPageReady);
        const result = await getPrice(page, asset);
        res.json({ ...result, durationMs: Date.now() - start });
    } catch (error: any) {
        if (error.message === 'BUSY_TRADING') {
            return res.status(503).json({ 
                error: 'Service temporarily unavailable: A trade is in progress and the requested asset requires UI navigation.',
                code: 'BUSY_TRADING',
                durationMs: Date.now() - start 
            });
        }
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

app.post('/trade/estimate', async (req, res) => {
    const start = Date.now();
    try {
        const { asset, amount, leverage, side } = req.body;

        if (!amount || !leverage || !side || (side !== 'long' && side !== 'short')) {
            return res.status(400).json({ error: 'Missing or invalid parameters. Required: amount (number), leverage (number), side ("long" or "short").', durationMs: Date.now() - start });
        }

        // Optimization: Use isPageReady to skip full load if already there
        const page = await getPage('https://jup.ag/perps', isPageReady);

        // Extra guard: verify the trade form input is interactable before estimate.
        // isPageReady checks price/balance, but the form may not have hydrated yet.
        const formInputReady = await page.getByPlaceholder('0.00').filter({ hasNotText: 'x' }).first()
            .waitFor({ state: 'visible', timeout: 8000 })
            .then(() => true)
            .catch(() => false);

        if (!formInputReady) {
            logger.warn('[/trade/estimate] Form input not yet visible. Reloading page and retrying...');
            await page.goto('https://jup.ag/perps', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
            await page.waitForTimeout(3000);
        }

        const estimation = await getTradeEstimation(page, side, Number(amount), asset, Number(leverage));
        res.json({ ...estimation, durationMs: Date.now() - start });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

app.post('/browser/visibility', async (req, res) => {
    const start = Date.now();
    try {
        const { visible } = req.body;
        // Support both boolean and the string "true"/"false" if sent improperly
        const isVisible = visible === true || visible === 'true';

        // 1. Persist the change to .env
        const envPath = path.resolve(__dirname, '../.env');
        try {
            let content = fs.readFileSync(envPath, 'utf8');
            if (content.includes('BROWSER_VISIBLE=')) {
                content = content.replace(/BROWSER_VISIBLE=.*/g, `BROWSER_VISIBLE=${isVisible}`);
            } else {
                content += `\nBROWSER_VISIBLE=${isVisible}\n`;
            }
            fs.writeFileSync(envPath, content);
            logger.info(`Persisted BROWSER_VISIBLE=${isVisible} to .env`);
        } catch (e: any) {
            logger.error('Failed to update .env file:', e.message);
            throw new Error('Persist failed: ' + e.message);
        }

        // 2. APPLY Visiblity Instantly (No restart needed anymore)
        const currentPid = getBrowserPid();
        await setWindowVisibility(isVisible, currentPid);

        res.json({ 
            message: `Browser visibility toggled to ${isVisible} instantly.`, 
            durationMs: Date.now() - start 
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

app.get('/browser/screenshot', async (req, res) => {
    const start = Date.now();
    try {
        const page = await getPage('https://jup.ag/perps', isPageReady);
        await page.bringToFront();
        const screenshotPath = path.resolve(__dirname, '../jup_screenshot.png');
        await page.screenshot({ path: screenshotPath });
        
        // Also capture some text elements for debug
        const debugTexts = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('span, div, p, button'))
                .map(e => e.textContent?.trim())
                .filter(t => t && (t.includes('Price') || t.includes('Liquidation') || t.includes('Fee') || t.includes('Balance') || t.includes('USDC') || t.includes('Insufficient') || t.includes('Connect Wallet')))
                .slice(0, 100);
        });

        res.json({
            message: 'Screenshot saved successfully to ' + screenshotPath,
            debugTexts,
            durationMs: Date.now() - start
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

app.get('/debug/dialog', requireDebug, async (req, res) => {
    const start = Date.now();
    try {
        const page = await getPage('https://jup.ag/perps', isPageReady);
        
        // Find token selector and click it
        const amountInput = page.getByPlaceholder('0.00').filter({ hasNotText: 'x' }).first();
        const tokenSelector = amountInput.locator('xpath=../..').locator('button').first();
        
        await tokenSelector.click();
        await page.waitForTimeout(1000);
        
        const data = await page.evaluate(() => {
            const dialog = document.querySelector('div[role="dialog"]');
            if (!dialog) return { found: false, html: document.body.innerHTML.substring(0, 5000) };
            
            const rows = Array.from(dialog.querySelectorAll('.cursor-pointer, [class*="cursor-pointer"]'));
            return {
                found: true,
                rowCount: rows.length,
                dialogHtml: dialog.outerHTML.substring(0, 3000),
                rows: rows.map((r, idx) => ({
                    idx,
                    tagName: r.tagName,
                    className: r.className,
                    innerText: (r as HTMLElement).innerText,
                    html: r.outerHTML.substring(0, 1000)
                }))
            };
        });
        
        await page.keyboard.press('Escape');
        
        res.json({ data, durationMs: Date.now() - start });
    } catch (error: any) {
        res.status(500).json({ error: error.message, durationMs: Date.now() - start });
    }
});

// Read version from package.json so there is a single source of truth.
let VERSION = "unknown";
try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));
    VERSION = pkg.version || VERSION;
} catch (e) { /* keep "unknown" */ }

const server = app.listen(port, async () => {
    logger.force(`====================================================`);
    logger.force(`Jupiter Agent service [v${VERSION}]`);
    logger.force(`Started at: ${new Date().toLocaleString()}`);
    logger.force(`Running at http://localhost:${port}`);
    logger.force(`====================================================`);

    try {
        logger.info('Initializing browser and background tasks...');
        const page = await getPage('https://jup.ag/perps', isPageReady);
        // Price serving needs no wallet, so start the warmer/balance loops FIRST and do NOT
        // await the wallet connect — connectWallet can hang for a long time (e.g. with no wallet
        // configured), and awaiting it would block price serving indefinitely. Fire-and-forget.
        startPriceWarmer(page);
        startBalanceUpdates(page).catch(err => logger.error('[Startup] Balance updates failed:', err));
        connectWallet(page).catch(err => logger.error('[Startup] connectWallet failed (continuing without wallet):', err.message));

        // Connection keeper: ensures the wallet reconnects automatically after a restart/reboot
        // or any disconnect — so trading keeps working without a manual /connect. jup.ag is a
        // trusted app in Phantom now, so reconnection is silent (no approval popup needed).
        const ensureWalletConnected = async () => {
            try {
                if (!isMaintenance()) {
                    const p = await getPage('https://jup.ag/perps', isPageReady);
                    const name = await getWalletName(p);
                    if (!name || name === 'Not Connected' || name === 'Unknown') {
                        logger.info('[ConnKeeper] Wallet not connected; reconnecting...');
                        await connectWallet(p).catch(() => {});
                    }
                }
            } catch {}
            setTimeout(ensureWalletConnected, 30000);
        };
        setTimeout(ensureWalletConnected, 25000);
    } catch (e: any) {
        logger.error('[Startup] Failed to initialize browser background tasks:', e.message);
    }
});

server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[FATAL] Port ${port} already in use after cleanup!`);
    } else {
        console.error(`[FATAL] Server error:`, err);
    }
    process.exit(1);
});

process.on('SIGINT', async () => {
    await closeBrowser();
    process.exit();
});
