import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function inspectJup() {
    const userDataDir = path.resolve(__dirname, '../Temporal/inspect_user_data');
    if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true });

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true, // Headless is fine for just inspecting static-ish content
        args: ['--no-sandbox']
    });

    const page = await context.newPage();
    try {
        console.log('Navigating to Jupiter Perps...');
        await page.goto('https://jup.ag/perps', { waitUntil: 'networkidle', timeout: 60000 });

        await page.waitForTimeout(5000); // Wait for animations

        const screenshotPath = path.resolve(__dirname, '../Temporal/jupiter_inspect.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('Screenshot saved to:', screenshotPath);

        // Try to dump some text to find selectors
        const content = await page.evaluate(() => {
            return {
                title: document.title,
                texts: Array.from(document.querySelectorAll('span, div, p')).map(el => (el as HTMLElement).innerText).filter(t => t.length > 0).slice(0, 100)
            };
        });

        console.log('Page Title:', content.title);
        // console.log('Sample Texts:', content.texts);

    } catch (e) {
        console.error('Inspection failed:', e);
    } finally {
        await context.close();
    }
}

inspectJup();
