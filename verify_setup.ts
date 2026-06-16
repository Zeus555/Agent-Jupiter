import { chromium } from 'playwright';
import { createNewWallet } from './src/phantom.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function finalVerification() {
    const extensionPath = 'd:\\PRC Agent Jupiter\\extensions\\phantom';
    const userDataDir = path.resolve(__dirname, 'Temporal/final_user_data');
    if (fs.existsSync(userDataDir)) fs.rmSync(userDataDir, { recursive: true });

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--no-sandbox'
        ],
    });

    try {
        console.log('Running final wallet creation verification...');
        const phrase = await createNewWallet(context);
        fs.writeFileSync('Temporal/credentials.txt', `Password: AgentJupiter2026!\nRecovery Phrase: ${phrase}\n`);
        console.log('Credentials saved to Temporal/credentials.txt');
    } catch (e) {
        console.error('Final verification failed:', e);
    } finally {
        await context.close();
    }
}

finalVerification();
