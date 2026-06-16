import type { Page, BrowserContext } from 'playwright';
import dotenv from 'dotenv';
import path from 'path';
import { cleanupTabs } from './browser.js';
import { logger } from './logger.js';
import fs from 'fs';


dotenv.config();

/**
 * Returns the Phantom unlock password from the environment.
 * Throws if unset — we deliberately removed the hardcoded fallback that used to
 * ship a real password in source (and therefore on GitHub).
 */
const getPhantomPassword = (): string => {
    const pw = process.env.PHANTOM_PASSWORD;
    if (!pw) {
        throw new Error('PHANTOM_PASSWORD is not set. Define it in .env — there is no built-in default.');
    }
    return pw;
};

export const createNewWallet = async (context: BrowserContext) => {
    const page = await context.newPage();
    try {
        const extId = process.env.PHANTOM_EXTENSION_ID || 'bfnaelmomeimhlpmgjnjophhpkkoljpa';
        const url = `chrome-extension://${extId}/onboarding.html`;

        logger.info(`Navigating to ${url}`);
        await page.goto(url).catch(e => logger.error('Goto failed:', e.message));

        await page.waitForTimeout(2000);

        // 1. Click "Create a new wallet"
        const createButton = page.getByRole('button', { name: /Create a new wallet/i });
        if (await createButton.isVisible()) {
            await createButton.click();
        }

        // 2. Click "Create a seed phrase wallet"
        const seedPhraseButton = page.getByRole('button', { name: /Create a seed phrase wallet/i });
        await seedPhraseButton.waitFor({ state: 'visible', timeout: 5000 });
        await seedPhraseButton.click();

        // 3. Set Password
        const password = getPhantomPassword();

        const passwordInputs = page.locator('input[type="password"]');
        await passwordInputs.nth(0).waitFor({ state: 'visible', timeout: 10000 });
        await passwordInputs.nth(0).fill(password);
        await passwordInputs.nth(1).fill(password);

        const tosCheckbox = page.locator('input[type="checkbox"]').first();
        await tosCheckbox.click();

        // This button might be disabled until password is valid
        const continueButton = page.getByRole('button', { name: /Continue|Next|Submit/i });
        await continueButton.click();

        logger.info('Password set. Securing recovery phrase...');

        // 4. Recovery Phrase — wait until the screen actually appears. On the weak P6100 CPU the
        // vault KDF after password submit can be slow, so allow a long timeout.
        await page.getByText(/Recovery Phrase|Secret Recovery Phrase/i).first()
            .waitFor({ state: 'visible', timeout: 75000 }).catch(() => {});
        await page.waitForTimeout(2500);

        // DIAGNOSTIC: dump the recovery-phrase screen so we can fix the reveal/capture selectors.
        try {
            fs.writeFileSync(path.resolve('wallet_debug.html'), await page.content());
            await page.screenshot({ path: path.resolve('wallet_debug.png'), fullPage: true });
            logger.force('[debug] Saved wallet_debug.html / wallet_debug.png');
        } catch (e) {}

        // Reveal phrase
        const viewport = page.viewportSize();
        if (viewport) {
            await page.mouse.click(viewport.width / 2, viewport.height / 2);
            logger.info('Clicked center to reveal phrase.');
        } else {
            // Fallback: Click a safe area
            await page.mouse.click(300, 300);
            logger.info('Viewport unknown, clicking fallback 300,300 to reveal phrase.');
        }

        await page.waitForTimeout(2000);

        // Click "I saved my Recovery Phrase" checkbox
        const recoveryCheckbox = page.getByText(/I saved my Recovery Phrase/i);
        await recoveryCheckbox.waitFor({ state: 'visible' });
        await recoveryCheckbox.click();

        // Extract the phrase
        const recoveryPhrase = await page.evaluate(() => {
            const container = (document.querySelector('[data-testid="recovery-phrase-container"]') || document.body) as HTMLElement;
            return container.innerText;
        });

        // Persist the seed to a local file (NEVER log it). Anyone with this file or
        // the password controls the wallet, so keep it out of logs and version control.
        try {
            const seedPath = path.resolve('wallet_seed.txt');
            fs.writeFileSync(seedPath, recoveryPhrase, { mode: 0o600 });
            logger.info(`Recovery phrase captured and written to ${seedPath} (keep this secret).`);
        } catch (e: any) {
            logger.warn('Could not persist recovery phrase to file:', e.message);
        }

        const phraseContinueButton = page.getByRole('button', { name: /Continue|Next/i });
        await phraseContinueButton.waitFor({ state: 'visible' });
        await phraseContinueButton.click();

        // 5. Final Steps
        await page.waitForTimeout(2000);
        const finishButton = page.getByRole('button', { name: /Finish|Get Started|Continue/i }).first();
        await finishButton.waitFor({ state: 'visible' });
        await finishButton.click();

        logger.info('Wallet creation complete. Fetching address on same page...');
        const popupUrl = `chrome-extension://${extId}/popup.html`;
        await page.goto(popupUrl).catch(() => {});
        await page.waitForTimeout(3000);
        
        const address = await page.evaluate(() => {
            // @ts-ignore
            return window.solana?.publicKey?.toString() || "Unknown";
        });
        
        // Persist the address to a file as requested
        try {
            fs.writeFileSync(path.resolve('wallet_address.txt'), address);
            logger.info(`Persisted wallet address: ${address}`);
        } catch (e: any) {}

        return { recoveryPhrase, address };
    } catch (error) {
        await page.screenshot({ path: path.resolve('Temporal/onboarding_error.png') });
        throw error;
    } finally {
        await page.close();
    }
};

/**
 * Imports an existing wallet into Phantom from its recovery phrase and sets it as the
 * active wallet. Assumes a FRESH profile (caller wipes user_data + relaunches first), so
 * Phantom shows onboarding. Importing is reliable because we type a known phrase (no need
 * to reveal/capture a generated one). Returns the wallet address.
 *
 * @param words  array of 12/24 recovery words (already validated by the caller)
 */
export const importWallet = async (context: BrowserContext, words: string[], password: string): Promise<{ address: string }> => {
    const extId = process.env.PHANTOM_EXTENSION_ID || 'bfnaelmomeimhlpmgjnjophhpkkoljpa';
    // REUSE the context's existing page instead of context.newPage(): opening a second tab is
    // flaky in this headless Chromium ("Failed to open a new tab"), and reusing the default
    // page also respects the two-tab limit. Fall back to newPage (with retries) only if needed.
    let page: Page | null = context.pages().find(p => !p.isClosed()) || null;
    if (!page) {
        for (let i = 0; i < 6; i++) {
            try { page = await context.newPage(); break; }
            catch (e: any) {
                logger.warn(`[importWallet] newPage attempt ${i + 1} failed: ${e.message}`);
                await new Promise(r => setTimeout(r, 2500));
            }
        }
    }
    if (!page) throw new Error('importWallet: could not obtain a usable tab (browser unstable).');
    const debug = process.env.AGENT_DEBUG === 'true';
    const dump = async (tag: string) => {
        if (!debug) return;
        try {
            fs.writeFileSync(path.resolve(`wallet_import_${tag}.html`), await page.content());
            await page.screenshot({ path: path.resolve(`wallet_import_${tag}.png`), fullPage: true });
        } catch {}
    };
    try {
        // Phantom's onboarding (MV3) frequently paints BLANK under automation right after the
        // extension loads. Navigate and wait for it to actually render; reload if still blank.
        const onboardingUrl = `chrome-extension://${extId}/onboarding.html`;
        let rendered = false;
        for (let attempt = 0; attempt < 5 && !rendered; attempt++) {
            await page.goto(onboardingUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
            for (let i = 0; i < 15; i++) {
                const btns = await page.locator('button').count().catch(() => 0);
                const txt = (await page.locator('body').innerText().catch(() => '')).trim();
                if (btns > 0 || txt.length > 20) { rendered = true; break; }
                await page.waitForTimeout(1000);
            }
            if (!rendered) {
                logger.warn(`[importWallet] onboarding still blank (attempt ${attempt + 1}); reloading...`);
                await page.waitForTimeout(2000);
            }
        }
        if (!rendered) throw new Error('importWallet: Phantom onboarding never rendered (blank MV3 page).');
        await page.waitForTimeout(1500);
        await dump('01_start');

        // 1. "I already have a wallet" / "Import"
        const haveWallet = page.getByRole('button', { name: /already have a wallet|import an existing wallet|import a wallet/i }).first();
        if (await haveWallet.isVisible({ timeout: 8000 }).catch(() => false)) {
            await haveWallet.click();
            await page.waitForTimeout(1500);
        }
        await dump('02_after_have_wallet');

        // 2. Choose "Import Secret Recovery Phrase" (some versions skip straight to entry)
        const srp = page.getByRole('button', { name: /secret recovery phrase|recovery phrase|seed phrase/i }).first();
        if (await srp.isVisible({ timeout: 4000 }).catch(() => false)) {
            await srp.click();
            await page.waitForTimeout(1500);
        }
        await dump('03_seed_entry');

        // 3. Enter the recovery phrase. Phantom typically distributes a pasted phrase across
        //    all word inputs; we paste into the first field, then fall back to per-word fill.
        const fields = page.locator('input[type="password"], input[type="text"], textarea');
        await fields.first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
        await fields.first().click().catch(() => {});
        await page.keyboard.insertText(words.join(' ')).catch(() => {});
        await page.waitForTimeout(800);
        // Fallback: if multiple inputs exist and the paste didn't fill them, fill each word.
        const count = await fields.count().catch(() => 0);
        if (count >= words.length) {
            const firstVal = await fields.first().inputValue().catch(() => '');
            if (!firstVal || firstVal.split(/\s+/).length < 2) {
                for (let i = 0; i < words.length; i++) {
                    await fields.nth(i).fill(words[i]!).catch(() => {});
                }
            }
        }
        await page.waitForTimeout(500);
        await dump('04_seed_filled');

        // 4. Continue / Import
        const cont1 = page.getByRole('button', { name: /^import$|^continue$|^next$/i }).first();
        if (await cont1.isVisible({ timeout: 4000 }).catch(() => false)) {
            await cont1.click();
            await page.waitForTimeout(2000);
        }
        await dump('05_after_seed');

        // 5. Password form (stable data-testids)
        const pw = page.locator('[data-testid="onboarding-form-password-input"]');
        if (await pw.isVisible({ timeout: 8000 }).catch(() => false)) {
            await pw.fill(password);
            await page.locator('[data-testid="onboarding-form-confirm-password-input"]').fill(password).catch(() => {});
            await page.locator('[data-testid="onboarding-form-terms-of-service-checkbox"]').click().catch(() => {});
            await page.locator('[data-testid="onboarding-form-submit-button"]').click().catch(() => {});
        } else {
            // Fallback to generic selectors
            const pwInputs = page.locator('input[type="password"]');
            if (await pwInputs.count() >= 2) {
                await pwInputs.nth(0).fill(password);
                await pwInputs.nth(1).fill(password);
                await page.locator('input[type="checkbox"]').first().click().catch(() => {});
                await page.getByRole('button', { name: /continue|import|submit|next/i }).first().click().catch(() => {});
            }
        }
        await page.waitForTimeout(3000);
        await dump('06_after_password');

        // 6. Finish / Get Started (may appear)
        const finish = page.getByRole('button', { name: /finish|get started|continue|done/i }).first();
        if (await finish.isVisible({ timeout: 6000 }).catch(() => false)) {
            await finish.click();
            await page.waitForTimeout(2000);
        }

        // 7. Read the address from the injected provider
        await page.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(3000);
        let address = 'Unknown';
        for (let i = 0; i < 6; i++) {
            address = await page.evaluate(() => {
                // @ts-ignore
                return (window.solana && window.solana.publicKey) ? window.solana.publicKey.toString() : 'Unknown';
            }).catch(() => 'Unknown');
            if (address && address !== 'Unknown') break;
            await page.waitForTimeout(1500);
        }
        await dump('07_done');

        if (address && address !== 'Unknown') {
            try { fs.writeFileSync(path.resolve('wallet_address.txt'), address); } catch {}
        }
        return { address };
    } catch (error: any) {
        await dump('99_error');
        throw error;
    } finally {
        await page.close().catch(() => {});
    }
};

export const unlockWallet = async (context: BrowserContext) => {
    const pages = context.pages();
    // Try to find if Phantom is already asking for a password
    let phantomPage = pages.find(p => p.url().includes('notification.html'));

    if (!phantomPage) {
        // Trigger the popup if possible, or just wait for it
        logger.info('Phantom unlock page not found. Waiting...');
        return;
    }

    const password = getPhantomPassword();
    const passwordInput = phantomPage.locator('input[type="password"]');

    if (await passwordInput.isVisible()) {
        await passwordInput.fill(password);
        await phantomPage.getByRole('button', { name: /Unlock/i }).click();
        logger.info('Wallet unlocked.');
    }
};

export const approveConnection = async (context: BrowserContext): Promise<boolean> => {
    logger.info('Waiting for native Phantom popup...');

    let popup: Page | null = null;
    const startTime = Date.now();
    const timeout = 15000;

    // 1. Poll for the native notification.html window that Phantom opens
    while (Date.now() - startTime < timeout) {
        const pages = context.pages();
        popup = pages.find(p => p.url().includes('notification.html')) || null;
        if (popup) break;
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (!popup) {
        logger.warn('Phantom native popup (notification.html) never appeared.');
        return false;
    }

    logger.info('Phantom popup detected. Verifying render state...');
    let clickedConfirm = false;
    try {
        await popup.bringToFront().catch(() => {});
        
        // --- DYNAMIC RENDER WAIT ---
        // Poll for DOM content every 100ms instead of sleeping a flat 2500ms.
        // This allows fast machines to proceed in ~300ms when the popup loads quickly,
        // while still tolerating up to 2.5s on slow/Mv3-bugged popups.
        let isBlank = true;
        for (let i = 0; i < 25; i++) {
            const rootContent = await popup.locator('#root').innerHTML().catch(() => '');
            const bodyText = await popup.locator('body').innerText().catch(() => '');
            if (rootContent.trim() !== '' || bodyText.trim().length > 20) {
                isBlank = false;
                logger.info(`[Phantom] Popup rendered after ~${(i + 1) * 100}ms.`);
                break;
            }
            await popup.waitForTimeout(100).catch(() => {});
        }

        // Soft buffer to let click-event handlers bind before we interact
        await popup.waitForTimeout(200).catch(() => {});

        if (isBlank) {
            logger.info('Phantom popup is persistent blank (Mv3 bug). Closing and requesting retry to wake it up...');
            await popup.close().catch(() => {});
            return false;
        }

        // 1.5 NEW: Check for simulation errors
        const simulationError = await popup.evaluate(() => {
            const bodyText = document.body.innerText;
            return bodyText.includes('reverted during simulation') || bodyText.includes('Simulation failed');
        }).catch(() => false);

        if (simulationError) {
            logger.error('Phantom simulation error detected!');
            throw new Error('Transaction simulation failed in wallet. This usually means the trade would fail or results in a loss.');
        }

        // 2. Check if locked, bypassing visibility using force checks
        const passwordInput = popup.locator('input[type="password"]');
        // Count elements instead of isVisible to bypass black-screen render bug
        const isLocked = await passwordInput.count() > 0;
        
        if (isLocked) {
            logger.info('Phantom is locked. Unlocking...');
            const password = getPhantomPassword();
            await passwordInput.fill(password, { force: true });
            await popup.getByRole('button', { name: /Unlock/i }).click({ force: true });
            await popup.waitForTimeout(2000);
        }

        // 3. Force click "Confirm" or "Approve" (Exact match to avoid clicking "Auto-Confirm")
        const approveButtonRegex = /^Connect$|^Approve$|^Confirm$/i;
        const approveButton = popup.getByRole('button', { name: approveButtonRegex, exact: true }).first();
        
        // Wait for the button to exist in DOM (not necessarily visible on screen)
        await approveButton.waitFor({ state: 'attached', timeout: 5000 }).catch(() => {});
        
        if (await approveButton.count() === 0) {
             const rootText = await popup.locator('body').innerText().catch(() => '');
             if (rootText.trim().length < 10) {
                logger.info("Phantom popup is empty or blank (render issue). Returning false to trigger retry...");
                return false; 
             }
             logger.info("Approval button ('Confirm' or 'Approve') not found but page has content. Closing popup...");
             await popup.close().catch(() => {});
             return false;
        }
        
        try {
            await approveButton.click({ force: true, timeout: 5000 });
            clickedConfirm = true; // MARK AS CLICKED
            logger.info('Phantom transaction approved successfully via exact button match.');
            
            // Wait briefly to see if it actually starts processing
            await popup.waitForTimeout(2000).catch(() => {});
            
            // If it's still open and showing an error, it didn't really succeed
            if (!popup.isClosed()) {
                const stillHasError = await popup.evaluate(() => {
                    const text = document.body.innerText.toLowerCase();
                    return text.includes('failed') || text.includes('retry') || text.includes('error');
                });
                if (stillHasError) {
                    logger.warn('Phantom popup still open after click and showing error.');
                    return false;
                }
            }
            return true;
        } catch (clickError: any) {
            const msg = clickError.message.toLowerCase();
            if (msg.includes('closed') || msg.includes('destroyed') || msg.includes('navigation')) {
                if (clickedConfirm) {
                    logger.info('Phantom popup closed after click. Proceeding.');
                    return true;
                }
                logger.info('Phantom popup closed BEFORE click could be confirmed. Treating as failure to trigger retry.');
                return false;
            }
            throw clickError;
        }
        
    } catch (e: any) {
        const msg = e.message.toLowerCase();
        if (msg.includes('closed') || msg.includes('destroyed')) {
             if (clickedConfirm) return true;
             logger.info('Phantom popup closed or destroyed during sequence. Treating as failure to trigger retry.');
             return false;
        }
        logger.warn('Failed to interact with native popup:', e.message);
        if (popup && !popup.isClosed()) {
             await popup.close().catch(() => {});
        }
        return false;
    }
};

export const directUnlock = async (context: BrowserContext) => {
    const extId = process.env.PHANTOM_EXTENSION_ID || 'bfnaelmomeimhlpmgjnjophhpkkoljpa';
    const popupUrl = `chrome-extension://${extId}/popup.html`;

    logger.info(`Checking extension state at ${popupUrl}...`);

    // 1. Try to reuse a blank page, otherwise create new
    const pages = context.pages();
    let page = pages.find(p => p.url() === 'about:blank');
    const isNewPage = !page;

    if (isNewPage) {
        page = await context.newPage();
    }

    try {
        await page!.goto(popupUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page!.waitForTimeout(2000);

        // Check for password input
        const passwordInput = page!.locator('input[type="password"]');
        if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
            logger.info('Phantom is locked. Unlocking via direct popup...');
            const password = getPhantomPassword();
            await passwordInput.fill(password);
            await page!.getByRole('button', { name: /Unlock/i }).click();
            await page!.waitForTimeout(3000);
            logger.info('Direct unlock attempt finished.');
        } else {
            logger.info('Phantom seems already unlocked or at main screen.');
        }
    } catch (e: any) {
        logger.warn('Direct unlock failed or timed out:', e.message);
    } finally {
        if (isNewPage && page) {
            await page.close().catch(() => { });
        } else if (page) {
            await page.goto('about:blank').catch(() => { });
        }
        // Sweep redundant tabs
        await cleanupTabs(context);
    }
};

export const getWalletAddressFromPhantom = async (context: BrowserContext): Promise<string> => {
    const extId = process.env.PHANTOM_EXTENSION_ID || 'bfnaelmomeimhlpmgjnjophhpkkoljpa';
    const popupUrl = `chrome-extension://${extId}/popup.html`;
    const page = await context.newPage();
    try {
        await page.goto(popupUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(2500);
        
        // 1. Check if locked
        const passwordInput = page.locator('input[type="password"]');
        if (await passwordInput.count() > 0) {
            const password = getPhantomPassword();
            await passwordInput.fill(password, { force: true });
            await page.getByRole('button', { name: /Unlock/i }).click({ force: true });
            await page.waitForTimeout(3000);
        }
        
        // 2. Extract address using window.solana (most reliable way for injected wallets)
        let address = "Unknown";
        for (let i = 0; i < 5; i++) {
            address = await page.evaluate(async () => {
                // @ts-ignore
                if (window.solana && window.solana.publicKey) {
                    // @ts-ignore
                    return window.solana.publicKey.toString();
                }
                // Fallback to DOM if not found
                const el = document.querySelector('[data-testid="wallet-address"], [data-testid="address-display"]');
                return (el as HTMLElement)?.innerText?.trim() || "Unknown";
            });
            if (address !== "Unknown") break;
            await page.waitForTimeout(1000);
        }
        
        return address;
    } catch (e: any) {
        logger.warn('[Phantom] Failed to fetch address from popup:', e.message);
        return "Unknown";
    } finally {
        await page.close().catch(() => {});
    }
};

export const getSavedWalletAddress = (): string => {
    try {
        const filePath = path.resolve('wallet_address.txt');
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8').trim();
        }
    } catch (e) {}
    return "Unknown";
};
