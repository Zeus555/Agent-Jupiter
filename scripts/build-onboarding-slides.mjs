// Builds the visual-onboarding slideshow frames from docs/ShowBrowser_*.png:
//  - scales each screenshot into a 1920x1080 dark frame,
//  - overlays black redaction boxes over any sensitive region (API key / VNC password / address),
//  - adds an explanatory caption bar.
// Output: docs/slides/slideNN.png  (then ffmpeg concatenates them into docs/onboarding.mp4).
//
//   node scripts/build-onboarding-slides.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DOCS = path.join(ROOT, 'docs');
const OUT = path.join(DOCS, 'slides');
fs.mkdirSync(OUT, { recursive: true });

// Redaction boxes are expressed as % of the screenshot (robust to scaling). Generous on purpose:
// covering an entire code block guarantees no partial secret leaks.
const CURL_0708 = { top: 42, left: 20, width: 60, height: 13 };
const RESP_0708 = { top: 60, left: 24, width: 56, height: 18 };
const CURL_15 = { top: 61, left: 20, width: 60, height: 10 };
const RESP_15 = { top: 79, left: 24, width: 56, height: 11 };
const ADDR_14 = { top: 72.8, left: 27.5, width: 33, height: 6 };

const slides = [
    { title: 'Visual wallet onboarding via noVNC', subtitle: 'PRC Agent Jupiter — connect or swap the trading wallet on demand, through the agent’s own browser' },
    { img: 'ShowBrowser_01.png', step: 1, cap: 'Jupiter Agent API — the full REST interface, documented in Swagger at /api-docs.' },
    { img: 'ShowBrowser_02.png', step: 2, cap: 'Authorize: the wallet-management endpoints are protected by an X-API-Key.' },
    { img: 'ShowBrowser_03.png', step: 3, cap: 'Authorized — the API key unlocks the protected wallet operations.' },
    { img: 'ShowBrowser_04.png', step: 4, cap: 'Endpoints available: price, trading, and on-demand wallet management.' },
    { img: 'ShowBrowser_05.png', step: 5, cap: 'POST /wallet/onboard-session starts a visual (noVNC) session to connect a wallet by hand.' },
    { img: 'ShowBrowser_06.png', step: 6, cap: 'Execute the request to open the on-demand visual session.' },
    { img: 'ShowBrowser_07.png', step: 7, cap: 'Response: a one-time noVNC URL + password. (API key & VNC password redacted.)', redact: [CURL_0708, RESP_0708] },
    { img: 'ShowBrowser_08.png', step: 8, cap: 'Copy the returned noVNC URL to open the agent’s live browser. (Secrets redacted.)', redact: [CURL_0708, RESP_0708] },
    { img: 'ShowBrowser_09.png', step: 9, cap: 'Inside noVNC: the agent’s Chromium on Jupiter Perpetuals (WBTC market).' },
    { img: 'ShowBrowser_10.png', step: 10, cap: 'The noVNC clipboard helper pastes the Phantom onboarding URL into the agent.' },
    { img: 'ShowBrowser_11.png', step: 11, cap: 'Navigating to the Phantom extension onboarding page.' },
    { img: 'ShowBrowser_12.png', step: 12, cap: 'Phantom renders in the visual session — create or import a wallet by hand.' },
    { img: 'ShowBrowser_13.png', step: 13, cap: 'Wallet connected — the agent is live and trading-ready on WBTC.' },
    { img: 'ShowBrowser_14.png', step: 14, cap: 'POST /wallet/onboard-session/close ends the session and resumes the agent.', redact: [ADDR_14] },
    { img: 'ShowBrowser_15.png', step: 15, cap: 'Session closed; agent resumed. (API key & wallet address redacted.)', redact: [CURL_15, RESP_15] },
];

const b64 = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;

const boxes = (redact = []) => redact.map(r =>
    `<div class="redact" style="top:${r.top}%;left:${r.left}%;width:${r.width}%;height:${r.height}%"></div>`).join('');

const frameHtml = (s) => {
    if (s.title) {
        return `<!doctype html><html><head><meta charset="utf-8">${STYLE}</head>
        <body><div class="title">
          <div class="brand">PRC Agent Jupiter</div>
          <h1>${s.title}</h1><p>${s.subtitle}</p>
          <div class="hint">RPA-as-a-service · the price/trade feed read straight from the UI</div>
        </div></body></html>`;
    }
    return `<!doctype html><html><head><meta charset="utf-8">${STYLE}</head>
    <body><div class="frame">
      <div class="shot"><img src="${b64(path.join(DOCS, s.img))}">${boxes(s.redact)}
        ${s.redact ? '<div class="seal">🔒 secrets redacted</div>' : ''}
      </div>
      <div class="cap"><span class="num">${s.step}/15</span><span>${s.cap}</span></div>
    </div></body></html>`;
};

const STYLE = `<style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:Segoe UI,Arial,sans-serif}
  body{width:1920px;height:1080px;background:#0d1117;overflow:hidden}
  .frame{width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 0}
  .shot{position:relative;height:930px;aspect-ratio:3840/2088;box-shadow:0 8px 40px rgba(0,0,0,.6);border:1px solid #30363d;border-radius:8px;overflow:hidden}
  .shot img{display:block;width:100%;height:100%}
  .redact{position:absolute;background:#0b0e13;border:1px solid #f85149;border-radius:4px}
  .seal{position:absolute;right:14px;bottom:12px;background:#f85149;color:#fff;font-size:18px;font-weight:700;padding:6px 12px;border-radius:6px;letter-spacing:.3px}
  .cap{width:1747px;margin-top:18px;display:flex;align-items:center;gap:18px;color:#e6edf3;font-size:30px;line-height:1.3}
  .cap .num{flex:0 0 auto;background:#1f6feb;color:#fff;font-weight:700;font-size:24px;padding:6px 14px;border-radius:20px}
  .title{width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:22px}
  .title .brand{color:#1f6feb;font-weight:800;letter-spacing:3px;font-size:30px;text-transform:uppercase}
  .title h1{color:#fff;font-size:74px;font-weight:800;max-width:1500px}
  .title p{color:#9da7b3;font-size:34px;max-width:1300px}
  .title .hint{margin-top:18px;color:#3fb950;font-size:26px;border:1px solid #238636;border-radius:24px;padding:10px 22px}
</style>`;

const run = async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    let i = 0;
    for (const s of slides) {
        await page.setContent(frameHtml(s), { waitUntil: 'load' });
        await page.waitForTimeout(150);
        const out = path.join(OUT, `slide${String(i).padStart(2, '0')}.png`);
        await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
        console.log('wrote', path.basename(out), s.img ? `(${s.img})` : '(title)');
        i++;
    }
    await browser.close();
    console.log(`\nDone: ${i} slides in docs/slides/`);
};
run().catch(e => { console.error(e); process.exit(1); });
