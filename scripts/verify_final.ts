import { chromium } from 'playwright';
import { getStatus } from '../src/jupiter.js';
import { initBrowser, getPage } from '../src/browser.js';

async function verifyFinal() {
    console.log('--- Verifying Final Polish (Popups & Balance) ---');
    const context = await initBrowser();
    const page = await getPage('https://jup.ag/perps');

    console.log('Waiting for stability (10s)...');
    await page.waitForTimeout(10000);

    console.log('Running Status check...');
    const start = Date.now();
    const status = await getStatus(page);
    const duration = Date.now() - start;

    console.log(`Duration: ${duration}ms`);
    console.log('Result:', JSON.stringify(status, null, 2));

    // Capture a screenshot for visual confirmation of the balance and absence of popups
    const screenshotPath = `d:/PRC Agent Jupiter/Temporal/final_verification.png`;
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);

    if (status.walletBalance && status.walletBalance !== '0 SOL' && status.walletBalance !== 'Not connected') {
        console.log('SUCCESS: Valid balance detected.');
    } else {
        console.log('WARNING: Balance is zero or missing. Check screenshot.');
    }

    await context.close();
}

verifyFinal().catch(console.error);
