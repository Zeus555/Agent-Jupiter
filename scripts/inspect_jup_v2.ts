import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function inspectJup() {
    const userDataDir = path.resolve(__dirname, '../Temporal/inspect_user_data_v2');
    if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true });

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        args: ['--no-sandbox']
    });

    const page = await context.newPage();
    try {
        console.log('Navigating to Jupiter Perps (v2)...');
        // Use 'domcontentloaded' which is faster than 'networkidle'
        await page.goto('https://jup.ag/perps', { waitUntil: 'domcontentloaded', timeout: 30000 });

        console.log('DOM Content Loaded. Waiting for some elements...');
        await page.waitForTimeout(10000);

        const screenshotPath = path.resolve(__dirname, '../Temporal/jupiter_inspect_v2.png');
        await page.screenshot({ path: screenshotPath });
        console.log('Screenshot saved to:', screenshotPath);

        // Extract some potential price/balance locations
        const data = await page.evaluate(() => {
            const spans = Array.from(document.querySelectorAll('span')).map(s => s.innerText);
            const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText);
            return { spans: spans.slice(0, 50), buttons: buttons.slice(0, 50) };
        });

        console.log('Spans:', data.spans);
        console.log('Buttons:', data.buttons);

    } catch (e) {
        console.error('Inspection failed:', e);
    } finally {
        await context.close();
    }
}

inspectJup();
