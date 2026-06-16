import { chromium } from 'playwright';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://jup.ag/perps');
    await page.waitForTimeout(10000); // Wait for full load

    const debugInfo = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('*')).filter(e => (e as HTMLElement).innerText?.trim() === 'Mark Price');
        return labels.map(l => {
            const parent = l.parentElement;
            return {
                tagName: l.tagName,
                text: (l as HTMLElement).innerText,
                siblingText: l.nextElementSibling ? (l.nextElementSibling as HTMLElement).innerText : 'NULL',
                parentHTML: parent ? parent.outerHTML.slice(0, 500) : 'NULL',
                parentText: parent ? parent.innerText : 'NULL'
            };
        });
    });

    console.log('MARK PRICE CANDIDATES:', JSON.stringify(debugInfo, null, 2));

    // Also search for the wrong value $91.20 (or similar format)
    const wrongValueCandidates = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('*')).filter(e => {
            const t = (e as HTMLElement).innerText?.trim();
            return t && t.startsWith('$') && t.length < 10;
        });
        return els.map(e => ({ text: (e as HTMLElement).innerText, tag: e.tagName, class: e.className }));
    });
    console.log('ALL DOLLAR VALUES:', JSON.stringify(wrongValueCandidates, null, 2));

    await browser.close();
})();
