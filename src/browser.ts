import { chromium } from 'playwright';
import type { BrowserContext, Page } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import { exec, execSync } from 'child_process';
import { directUnlock } from './phantom.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// The window-hiding, PID-lookup and taskkill paths are Windows-only. In a Linux
// container the browser runs headless-of-desktop under Xvfb (never visible), so these
// become no-ops and process teardown is handled by context.close() + the container.
const isWindows = process.platform === 'win32';

let context: BrowserContext | null = null;
let launchPromise: Promise<BrowserContext> | null = null;
const pageCache = new Map<string, Page>();
const navigationPromises = new Map<string, Promise<Page>>();

/**
 * Native Windows Window Management
 * nCmdShow: 0 = Hide, 5 = Show
 */
export const setWindowVisibility = (visible: boolean, pid?: number | null): Promise<void> => {
    return new Promise((resolve) => {
        if (!isWindows) {
            // No desktop window to toggle inside a container — nothing to do.
            logger.info('[visibility] Skipped (non-Windows / containerized: browser has no visible window).');
            return resolve();
        }
        const scriptPath = path.resolve(__dirname, 'visibility.ps1');
        const flag = visible ? 'true' : 'false';
        const pidFlag = pid ? `-targetPid ${pid}` : '';
        const fullCmd = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -visible ${flag} ${pidFlag}`;
        
        exec(fullCmd, (err, stdout) => {
            if (err) {
                logger.error(`Visibility toggle error: ${err.message}`);
            } else {
                logger.info(`Visibility toggle stdout: ${stdout.trim()}`);
            }
            resolve();
        });
    });
};

export const initBrowser = async () => {
    if (launchPromise) return launchPromise;

    launchPromise = (async () => {
        try {
            const extensionPath = process.env.PHANTOM_EXTENSION_PATH;
            if (!extensionPath) throw new Error('PHANTOM_EXTENSION_PATH not defined');

            const isVisibleEnv = process.env.BROWSER_VISIBLE === 'true';
            const userDataDir = path.resolve(__dirname, '../user_data');

            // Remove any stale Chromium profile lock. The user_data volume persists across
            // container recreations; a Singleton* lock written by a previous container (a
            // different "computer"/PID) makes Chromium refuse the profile and fail to open
            // tabs ("profile appears to be in use by another Chromium process").
            for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
                try { fs.rmSync(path.join(userDataDir, f), { force: true, recursive: true }); } catch {}
            }

            logger.force(`Initializing browser (Mode: HEADFUL + OS TOGGLE)`);

            // ALWAYS launch headless: false so extensions and UI work. On the weak/headless
            // host the first launch sometimes crashes ("Target page/browser closed"); retry a
            // few times (clearing the lock each time) so getPage reliably returns a live browser.
            const launchArgs = [
                `--disable-extensions-except=${extensionPath}`,
                `--load-extension=${extensionPath}`,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--window-size=1600,1200'
            ];
            context = null;
            let lastErr: any = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
                        try { fs.rmSync(path.join(userDataDir, f), { force: true, recursive: true }); } catch {}
                    }
                    context = await chromium.launchPersistentContext(userDataDir, {
                        headless: false,
                        args: launchArgs,
                        viewport: { width: 1600, height: 1200 }
                    });
                    break;
                } catch (e: any) {
                    lastErr = e;
                    logger.warn(`[initBrowser] launch attempt ${attempt}/3 failed: ${e.message}`);
                    try { execSync(`pkill -9 -f "${userDataDir}"`); } catch {}
                    await new Promise(r => setTimeout(r, 3000));
                }
            }
            if (!context) throw lastErr || new Error('launchPersistentContext failed after retries');


            if (context) {
                context.on('close', () => {
                    context = null;
                    launchPromise = null;
                    pageCache.clear();
                    navigationPromises.clear();
                });

                // 1. APPLY OS HIDING IMMEDIATELY after launch if needed
                // if (!isVisibleEnv) {
                //     logger.info('Auto-hiding browser window immediately (Invisible Unlock mode)...');
                //     const browserPid = getBrowserPid();
                //     setWindowVisibility(false, browserPid);
                // }

                // 2. Initial wait for extensions (Happens in background)
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // 3. Perform wallet unlock (Happens in background)
                logger.info('Performing wallet unlock in background...');
                await directUnlock(context).catch(e => logger.warn('Wallet unlock background issue:', e.message));

                await cleanupTabs(context);
            }

            return context!;
        } catch (error: any) {
            logger.error(`Launch crash: ${error.message}`);
            launchPromise = null;
            throw error;
        }
    })();

    return launchPromise;
};

export const cleanupTabs = async (ctx: BrowserContext) => {
    if (!ctx) return;
    try {
        const pages = ctx.pages();
        const cachedPages = Array.from(pageCache.values());
        for (const p of pages) {
            const url = p.url();
            if (url === 'about:blank' || (url.includes('chrome-extension') && !cachedPages.includes(p))) {
                if (!p.isClosed() && pages.length > 1) await p.close().catch(() => {});
            }
        }
    } catch (e) {
        logger.warn('Tab cleanup failed:', e);
    }
};

/** Returns the URL of a cached page without navigating (diagnostic helper). */
export const getCachedPageUrl = (url: string): string | null => {
    const p = pageCache.get(url);
    return p && !p.isClosed() ? p.url() : null;
};

export const getBrowserPid = (): number | null => {
    // PID lookup is only used by the Windows window-hiding/taskkill paths.
    if (!isWindows) return null;
    try {
        // For persistent context, context.browser() is null.
        // We can find it by looking for the process with our userDataDir in command line.
        const userDataDir = path.resolve(__dirname, '../user_data').toLowerCase().replace(/\\/g, '\\\\');
        
        // This is reliable on Windows: Find the main chrome process (no --type=) with our userDataDir
        const cmd = `powershell -Command "Get-CimInstance Win32_Process -Filter \\"Name = 'chrome.exe'\\" | Where-Object { $_.CommandLine -like '*${userDataDir}*' -and $_.CommandLine -notlike '*--type=*' } | Select-Object -ExpandProperty ProcessId"`;
        
        const output = execSync(cmd).toString().trim();
        const pids = output.split(/\s+/);
        // Take the first one (usually the main process)
        const firstPid = pids[0];
        if (!firstPid) return null;
        const pid = parseInt(firstPid);
        if (!isNaN(pid)) logger.info(`Found browser PID: ${pid}`);
        return isNaN(pid) ? null : pid;
    } catch (e) {
        return null;
    }
};

/**
 * Closes the browser and wipes the persistent profile (user_data), so the next launch
 * starts Phantom from a clean onboarding state. Used when (re)importing a wallet.
 */
export const resetProfile = async (): Promise<void> => {
    await closeBrowser();
    const userDataDir = path.resolve(__dirname, '../user_data');
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e: any) {
        logger.warn('[resetProfile] could not wipe user_data:', e?.message);
    }
};

export const getBrowserContext = async (): Promise<BrowserContext> => {
    if (!context) await initBrowser();
    if (!context) throw new Error('Context setup failed');
    return context;
};

export const getPage = async (url: string, validator?: (page: Page) => Promise<boolean>): Promise<Page> => {
    const existingNav = navigationPromises.get(url);
    if (existingNav) return existingNav;

    const navPromise = (async () => {
        try {
            const ctx = await getBrowserContext();
            let page = pageCache.get(url);
            
            if (page && !page.isClosed()) {
                const ok = validator ? await validator(page).catch(() => false) : true;
                if (ok) return page;
                await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
            } else {
                const pages = ctx.pages();
                page = pages.find(p => p.url().includes(url));
                if (!page) {
                    const blank = pages.find(p => p.url() === 'about:blank');
                    page = blank || await ctx.newPage();
                }
                pageCache.set(url, page);
            }

            if (!page.url().includes(url) || page.url() === 'about:blank') {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            }


            await cleanupTabs(ctx);
            return page;
        } finally {
            navigationPromises.delete(url);
        }
    })();

    navigationPromises.set(url, navPromise);
    return navPromise;
};

export const closeBrowser = async () => {
    if (context) await context.close().catch(() => {});
    if (isWindows) {
        const pid = getBrowserPid();
        if (pid) {
            logger.info(`Forcefully terminating browser process tree for PID: ${pid} to release resource locks...`);
            try { execSync(`taskkill /F /PID ${pid} /T`); } catch (err) {}
        }
    } else {
        // Linux/container: context.close() can leave a hung Chromium holding the profile lock,
        // which makes the next launch fail with "profile appears to be in use". Force-kill any
        // chromium still using our user_data dir so a relaunch starts clean.
        const ud = path.resolve(__dirname, '../user_data');
        try { execSync(`pkill -9 -f "${ud}"`); } catch (err) {}
    }
    context = null;
    launchPromise = null;
    pageCache.clear();
    navigationPromises.clear();
};
