import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function inspectTrade() {
    const userDataDir = path.resolve(__dirname, '../Temporal/inspect_trade_user_data');
    if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true });

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        args: ['--no-sandbox']
    });

    const page = await context.newPage();
    try {
        console.log('Navigating to Jupiter Perps for Trade Inspection...');
        await page.goto('https://jup.ag/perps', { waitUntil: 'domcontentloaded', timeout: 30000 });

        await page.waitForTimeout(10000);

        // Extract button and input roles/names
        const elements = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
                text: b.innerText,
                type: b.getAttribute('type'),
                class: b.className
            }));
            const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
                placeholder: i.getAttribute('placeholder'),
                value: i.value,
                class: i.className
            }));
            return { buttons, inputs };
        });

        console.log('--- BUTTONS ---');
        console.log(JSON.stringify(elements.buttons.slice(0, 40), null, 2));
        console.log('--- INPUTS ---');
        console.log(JSON.stringify(elements.inputs, null, 2));

        const screenshotPath = path.resolve(__dirname, '../Temporal/jupiter_trade_inspect.png');
        await page.screenshot({ path: screenshotPath });
        console.log('Screenshot saved to:', screenshotPath);

    } catch (e) {
        console.error('Inspection failed:', e);
    } finally {
        await context.close();
    }
}

inspectTrade();
