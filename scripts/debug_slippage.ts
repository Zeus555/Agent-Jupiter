import { chromium } from 'playwright';
import { getPage } from '../src/browser.js';
import dotenv from 'dotenv';
import { connectWallet } from '../src/jupiter.js';

dotenv.config();

(async () => {
    console.log('Starting Slippage Debug...');
    const browser = await chromium.launch({
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certificate-errors',
            '--ignore-certificate-errors-spki-list',
            '--disable-web-security'
        ]
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        await page.goto('https://jup.ag/perps');
        console.log('Navigated to Jupiter Perps');
        await page.waitForTimeout(5000);

        // Click Slippage Button
        const slippageBtn = page.getByRole('button', { name: /Max: \d+(\.\d+)?%/ }).first();
        if (await slippageBtn.isVisible()) {
            console.log('Found Slippage Button, clicking...');
            await slippageBtn.click();
            await page.waitForTimeout(1000);

            await page.screenshot({ path: 'debug_slippage_modal.png' });
            console.log('Screenshot saved: debug_slippage_modal.png');

            const settingsModal = page.locator('div[role="dialog"]').first();
            if (await settingsModal.isVisible()) {
                console.log('Settings modal visible.');

                // Check for Custom button
                const customBtn = settingsModal.locator('button').getByText(/Custom/i).first();
                if (await customBtn.isVisible()) {
                    console.log('Custom button found, clicking...');
                    await customBtn.click();
                    await page.waitForTimeout(500);
                } else {
                    console.log('Custom button NOT found.');
                }

                // Check for Inputs
                const inputs = await settingsModal.locator('input').all();
                console.log(`Found ${inputs.length} inputs in modal.`);

                for (let i = 0; i < inputs.length; i++) {
                    const viz = await inputs[i].isVisible();
                    const val = await inputs[i].inputValue();
                    const ph = await inputs[i].getAttribute('placeholder');
                    console.log(`Input ${i}: Visible=${viz}, Value="${val}", Placeholder="${ph}"`);

                    if (viz) {
                        try {
                            console.log(`Attempting to fill Input ${i} with 0.5...`);
                            await inputs[i].fill('0.5');
                            await page.waitForTimeout(500);
                        } catch (e) {
                            console.log(`Failed to fill Input ${i}:`, e);
                        }
                    }
                }

                await page.screenshot({ path: 'debug_slippage_after_fill.png' });

                const saveBtn = settingsModal.getByText(/Save Settings/i).first();
                if (await saveBtn.isVisible()) {
                    console.log('Save Settings button found, clicking...');
                    await saveBtn.click();
                } else {
                    console.log('Save Settings button NOT found. Pressing Enter...');
                    await page.keyboard.press('Enter');
                }
            } else {
                console.log('Settings modal NOT visible.');
            }
        } else {
            console.log('Slippage Button NOT found.');
        }

        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'debug_slippage_final.png' });

    } catch (e) {
        console.error('An error occurred:', e);
    } finally {
        await browser.close();
    }
})();
