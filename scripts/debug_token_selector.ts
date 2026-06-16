import { chromium } from 'playwright';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://jup.ag/perps');
    await page.waitForTimeout(10000);

    // Find the input
    const input = page.getByPlaceholder('0.00').first();
    if (await input.isVisible()) {
        // Go up to common container
        const parent = input.locator('xpath=..');
        const grandParent = input.locator('xpath=../..');

        console.log('Input Parent HTML:', await parent.evaluate(e => e.outerHTML));
        console.log('Input GrandParent HTML:', await grandParent.evaluate(e => e.outerHTML));

        // Try to find the selector button within GrandParent
        // It usually has an image (logo) and text (SOL/USDC) and maybe a chevron
        const candidates = await grandParent.locator('button').all();
        console.log(`Found ${candidates.length} buttons in GrandParent`);

        for (const btn of candidates) {
            console.log('Button HTML:', await btn.evaluate(e => e.outerHTML));
            const text = await btn.innerText();
            if (text.includes('SOL') || text.includes('USDC')) {
                console.log('POTENTIAL MATCH:', text);
                // Try clicking it to see if modal opens
                await btn.click();
                await page.waitForTimeout(1000);
                const modal = page.locator('div[role="dialog"]');
                if (await modal.isVisible()) {
                    console.log('MODAL OPENED!');
                    const options = await modal.innerText();
                    console.log('Modal Options:', options.slice(0, 100));
                    await page.keyboard.press('Escape');
                }
            }
        }
    } else {
        console.log('Input not found');
    }

    await browser.close();
})();
