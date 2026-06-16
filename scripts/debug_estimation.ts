import { chromium } from 'playwright';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://jup.ag/perps');
    await page.waitForTimeout(10000); // Wait for load

    const result: any = {};

    // 0.5 Switch to USDC (Refined)
    const payingContext = page.getByText("You're paying");
    // Dump the paying context HTML to see the button
    const payingHtml = await payingContext.locator('xpath=..').evaluate(e => e.outerHTML);
    result.payingHtml = payingHtml;

    const tokenTrigger = payingContext.locator('xpath=..').locator('button').first();
    if (await tokenTrigger.isVisible()) {
        await tokenTrigger.click();
        await page.waitForTimeout(2000);

        // Dump the entire body to find where the modal is
        // It might be a portal at the end of body
        const bodyText = await page.evaluate(() => document.body.innerText);
        result.bodyHasUSDC = bodyText.includes('USDC');

        // Try to find ANY button with USDC text now
        const usdcBtn = page.getByRole('button', { name: 'USDC' }).first();
        if (await usdcBtn.isVisible()) {
            await usdcBtn.click();
            await page.waitForTimeout(1000);
            result.tokenSwitched = true;
        } else {
            result.tokenSwitched = false;
        }
    }

    // 1. Enter 100 USDC
    await page.getByPlaceholder('0.00').first().fill('100');
    await page.waitForTimeout(3000); // Wait for calculation

    // 2. Re-Inspect Info Panel with values
    const infoLabels = ['Entry Price', 'Liquidation Price', 'Slippage', 'Total Fees'];
    result.infoPanel = [];
    for (const label of infoLabels) {
        const el = page.getByText(label).first();
        if (await el.isVisible().catch(() => false)) {
            const container = el.locator('xpath=..');
            const text = await container.innerText();

            let details: any[] = [];
            if (label === 'Total Fees') {
                // Try to capture everything below "Total Fees" header in the same block
                // The structure is likely: 
                // Context -> [Total Fees Row] -> [Sub Row 1] -> [Sub Row 2]
                // Or they are siblings. 
                // Let's dump the parent's text content fully.
                const parent = el.locator('xpath=../..');
                details.push(await parent.innerText());
            }

            result.infoPanel.push({
                label,
                fullText: text,
                details
            });
        }
    }

    // 3. Inspect Slippage Interaction (Settings Icon Strategy)
    // Look for a settings icon (likely an SVG button near the top right or near slippage)
    // Common selector for settings gear
    const settingsIcon = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasNotText: /[a-zA-Z]/ }).first();
    // Or closer to "Slippage" text?
    const slippageLabel = page.getByText('Slippage').first();
    // Maybe the 'Max: 2%' button IS the way, but maybe I missed the modal selector.
    // Let's try clicking 'Max: 2%' again and dumping body.

    const slippageBtn = page.getByRole('button', { name: /Max: \d+%/ }).first();
    if (await slippageBtn.isVisible()) {
        await slippageBtn.click();
        await page.waitForTimeout(1000);

        const dialog = page.getByRole('dialog');
        if (await dialog.isVisible()) {
            result.slippageModalOpen = true;
            result.dialogText = await dialog.innerText();
            result.dialogHtml = await dialog.evaluate(e => e.outerHTML.slice(0, 500));
        } else {
            // Look for popover?
            result.slippageModalOpen = false;
            result.lastChanceHtml = await page.evaluate(() => document.body.innerHTML.slice(-2000));
        }
    }

    console.log('DEBUG INFO:', JSON.stringify(result, null, 2));

    await browser.close();
})();
