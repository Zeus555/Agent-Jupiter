import { chromium } from 'playwright';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://jup.ag/perps');
    await page.waitForTimeout(10000); // Wait for load

    // Click "Long/Buy"
    await page.getByText('Long/Buy', { exact: true }).first().click();
    await page.waitForTimeout(1000);

    const debugInfo = await page.evaluate(() => {
        const result: any = {};

        // 1. DUMP ALL INPUTS
        const inputs = Array.from(document.querySelectorAll('input'));
        result.allInputs = inputs.map(i => ({
            type: i.type,
            placeholder: i.placeholder,
            value: i.value,
            id: i.id,
            class: i.className,
            parentHTML: i.parentElement?.outerHTML.slice(0, 200)
        }));

        // 2. Find TP/SL Label specifically (leaf node)
        const allText = Array.from(document.querySelectorAll('span, div, label, p'));
        const tpLabel = allText.find(e => {
            const t = (e as HTMLElement).innerText?.trim();
            return t === 'Take Profit / Stop Loss';
        });
        if (tpLabel) {
            result.tpLabel = {
                tag: tpLabel.tagName,
                class: tpLabel.className,
                html: tpLabel.outerHTML,
                siblingHTML: tpLabel.nextElementSibling?.outerHTML.slice(0, 200),
                parentHTML: tpLabel.parentElement?.outerHTML.slice(0, 200)
            };
        }

        // 3. Leverage Input
        // Find element with text "100x" or similar that looks central
        // Or look for "1.1x" ... "250x" context

        return result;
    });

    console.log('DEBUG INFO:', JSON.stringify(debugInfo, null, 2));
    await browser.close();
})();
