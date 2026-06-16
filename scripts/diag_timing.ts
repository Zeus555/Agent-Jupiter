import { getPage, initBrowser } from '../src/browser.js';
import { getStatus, isPageReady } from '../src/jupiter.js';

async function diag() {
    console.log('--- Direct Diagnostic ---');

    await initBrowser();
    console.log('Browser ready.\n');

    // CALL 1
    console.log('=== CALL 1 ===');
    const t1 = Date.now();
    const page1 = await getPage('https://jup.ag/perps', isPageReady);
    console.log(`[CALL 1] getPage took ${Date.now() - t1}ms`);

    const t1s = Date.now();
    const status1 = await getStatus(page1);
    console.log(`[CALL 1] getStatus took ${Date.now() - t1s}ms`);
    console.log(`[CALL 1] Total: ${Date.now() - t1}ms`, JSON.stringify(status1));

    console.log('\n=== CALL 2 ===');
    const t2 = Date.now();
    const page2 = await getPage('https://jup.ag/perps', isPageReady);
    console.log(`[CALL 2] getPage took ${Date.now() - t2}ms`);

    const t2s = Date.now();
    const status2 = await getStatus(page2);
    console.log(`[CALL 2] getStatus took ${Date.now() - t2s}ms`);
    console.log(`[CALL 2] Total: ${Date.now() - t2}ms`, JSON.stringify(status2));

    if (Date.now() - t2 < 500) {
        console.log('\nSUCCESS: Second call was instant!');
    } else {
        console.log('\nFAILURE: Second call still slow.');
    }

    // Clean up
    const { closeBrowser } = await import('../src/browser.js');
    await closeBrowser();
}

diag().catch(console.error);
