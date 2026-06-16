import { chromium } from 'playwright';
import { getStatus, isPageReady } from '../src/jupiter.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyFix() {
    console.log('Starting browser to verify fixing false positives...');
    
    const userDataDir = path.resolve(__dirname, '../Temporal/verify_fix_user_data');
    if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log('Navigating to Jupiter Perps (SOL)...');
        // Initial navigation
        await page.goto('https://jup.ag/perps', { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Wait for page to be "ready" enough
        console.log('Waiting for UI to stabilize...');
        await page.waitForTimeout(10000);

        console.log('Calling getStatus("SOL")...');
        const status = await getStatus(page, 'SOL');

        console.log('\n--- VERIFICATION RESULTS ---');
        console.log('Asset:', status.asset);
        console.log('Price:', status.price);
        console.log('Wallet Balance:', status.walletBalance);
        console.log('Positions Count:', status.positions.length);

        if (status.positions.length > 0) {
            console.warn('⚠️ WARNING: False positive positions detected!');
            status.positions.forEach((p: any, i: number) => {
                console.warn(`Position ${i + 1}:`, p.asset, p.size);
            });
        } else {
            console.log('✅ SUCCESS: No false positive positions reported.');
        }

        console.log('Debug trace:', JSON.stringify(status._debug || [], null, 2));
        
        // Final screenshot for visual confirmation
        const screenshotPath = path.resolve(__dirname, '../Temporal/fix_verification.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('\nScreenshot saved to:', screenshotPath);

    } catch (e: any) {
        console.error('Verification failed:', e.message);
    } finally {
        await browser.close();
    }
}

verifyFix();
