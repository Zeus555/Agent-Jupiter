import { chromium } from 'playwright';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const extractPhrase = async () => {
    const extensionPath = process.env.PHANTOM_EXTENSION_PATH!;
    const userDataDir = path.resolve(__dirname, '../user_data');
    const extId = process.env.PHANTOM_EXTENSION_ID!;

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
        ],
    });

    const page = await context.newPage();
    try {
        // Unlock if needed
        await page.goto(`chrome-extension://${extId}/popup.html`);
        const passwordInput = page.getByPlaceholder('Password');
        if (await passwordInput.isVisible()) {
            await passwordInput.fill(process.env.PHANTOM_PASSWORD!);
            await page.keyboard.press('Enter');
            await page.waitForTimeout(2000);
        }

        // Go to settings to find recovery phrase
        // This is complex, let's try to just find it in the onboarding if it's still there
        // Actually, if it's already finish, onboarding won't work.

        console.log('Wallet is setup. Searching for phrase extraction method...');

    } finally {
        await context.close();
    }
};

extractPhrase();
