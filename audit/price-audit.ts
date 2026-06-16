/**
 * Price-accuracy audit sampler.
 *
 * Periodically samples, as close to the same instant as possible:
 *   1. the agent's UI-derived price        (GET <AGENT_URL>/price?asset=<ASSET> — exactly what
 *                                            consumers like sentinel014 receive, incl. ageMs/stale)
 *   2. Jupiter Price API v3                 (spot USD price of the asset's mint)
 *   3. Pyth                                 (the oracle Jupiter Perps derives its mark from)
 *
 * Writes one JSON line per sample to audit/data/<asset>-<timestamp>.jsonl. It NEVER touches the
 * agent's trading path — it only reads /price (a cached, lock-free read). Analyze with analyze.ts.
 *
 * Run from the project root:
 *   AGENT_URL=http://localhost:3011 ./node_modules/.bin/tsx audit/price-audit.ts
 * Env knobs: AGENT_URL, AUDIT_ASSET (default WBTC), AUDIT_INTERVAL_MS (5000),
 *            AUDIT_DURATION_MS (0 = until Ctrl+C), AUDIT_OUT_DIR.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MARKETS } from './markets.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const AGENT_URL = (process.env.AGENT_URL || 'http://localhost:3011').replace(/\/$/, '');
const ASSET = (process.env.AUDIT_ASSET || 'WBTC').toUpperCase();
const INTERVAL_MS = Number(process.env.AUDIT_INTERVAL_MS) || 5000;
const DURATION_MS = Number(process.env.AUDIT_DURATION_MS) || 0; // 0 = run until SIGINT
const OUT_DIR = process.env.AUDIT_OUT_DIR || path.join(HERE, 'data');
const V3_BASE = process.env.JUP_PRICE_BASE || 'https://lite-api.jup.ag/price/v3';
const PYTH_BASE = process.env.PYTH_BASE || 'https://hermes.pyth.network/v2/updates/price/latest';

const market = MARKETS[ASSET];
if (!market) {
    console.error(`Unknown asset "${ASSET}". Known: ${Object.keys(MARKETS).join(', ')}`);
    process.exit(1);
}

const num = (s: unknown): number | null => {
    if (s === null || s === undefined) return null;
    const v = parseFloat(String(s).replace(/[$,]/g, ''));
    return isNaN(v) ? null : v;
};

// 10000 * (a - b) / b — signed relative error in basis points (1 bp = 0.01%).
const bps = (a: number | null, b: number | null): number | null =>
    a === null || b === null || b === 0 ? null : Number((10000 * (a - b) / b).toFixed(3));

async function timedFetch(url: string, opts?: RequestInit): Promise<{ ms: number; res: Response }> {
    const t0 = Date.now();
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(10000) });
    return { ms: Date.now() - t0, res };
}

async function sampleAgent() {
    try {
        const { ms, res } = await timedFetch(`${AGENT_URL}/price?asset=${ASSET}`);
        const j: any = await res.json();
        return { ui: num(j.price), uiAgeMs: j.ageMs ?? null, uiStale: !!j.stale, uiReqMs: j.durationMs ?? null, uiFetchMs: ms, err: null as string | null };
    } catch (e: any) {
        return { ui: null, uiAgeMs: null, uiStale: null, uiReqMs: null, uiFetchMs: null, err: e.message };
    }
}

async function sampleV3() {
    try {
        const { ms, res } = await timedFetch(`${V3_BASE}?ids=${market.mint}`);
        const j: any = await res.json();
        const e = j[market.mint];
        return { v3: num(e?.usdPrice), v3BlockId: e?.blockId ?? null, v3FetchMs: ms, err: null as string | null };
    } catch (e: any) {
        return { v3: null, v3BlockId: null, v3FetchMs: null, err: e.message };
    }
}

async function samplePyth() {
    try {
        const { ms, res } = await timedFetch(`${PYTH_BASE}?ids[]=${market.pythFeed}&parsed=true&encoding=hex`);
        const j: any = await res.json();
        const p = j?.parsed?.[0]?.price;
        if (!p) return { pyth: null, pythConf: null, pythPublishTs: null, pythFetchMs: ms, err: 'no parsed price' };
        const scale = Math.pow(10, p.expo);
        return { pyth: Number((Number(p.price) * scale).toFixed(6)), pythConf: Number((Number(p.conf) * scale).toFixed(6)), pythPublishTs: p.publish_time, pythFetchMs: ms, err: null as string | null };
    } catch (e: any) {
        return { pyth: null, pythConf: null, pythPublishTs: null, pythFetchMs: null, err: e.message };
    }
}

async function tick(out: fs.WriteStream) {
    const tsMs = Date.now();
    const [a, v3, py] = await Promise.all([sampleAgent(), sampleV3(), samplePyth()]);

    const row = {
        ts: new Date(tsMs).toISOString(),
        tsMs,
        asset: ASSET,
        ui: a.ui, uiAgeMs: a.uiAgeMs, uiStale: a.uiStale, uiReqMs: a.uiReqMs, uiFetchMs: a.uiFetchMs,
        v3: v3.v3, v3BlockId: v3.v3BlockId, v3FetchMs: v3.v3FetchMs,
        pyth: py.pyth, pythConf: py.pythConf, pythPublishTs: py.pythPublishTs,
        pythAgeMs: py.pythPublishTs ? tsMs - py.pythPublishTs * 1000 : null,
        pythFetchMs: py.pythFetchMs,
        bps_ui_v3: bps(a.ui, v3.v3),
        bps_ui_pyth: bps(a.ui, py.pyth),
        bps_v3_pyth: bps(v3.v3, py.pyth),
        errors: { agent: a.err, v3: v3.err, pyth: py.err },
    };
    out.write(JSON.stringify(row) + '\n');

    const f = (n: number | null) => (n === null ? '  n/a  ' : n.toFixed(2).padStart(9));
    const b = (n: number | null) => (n === null ? '  n/a ' : (n >= 0 ? '+' : '') + n.toFixed(2));
    console.log(
        `${row.ts}  ui=${f(row.ui)} (age ${String(row.uiAgeMs ?? '?').padStart(5)}ms${row.uiStale ? ' STALE' : '     '})` +
        `  v3=${f(row.v3)}  pyth=${f(row.pyth)}  | bpsΔ ui-v3 ${b(row.bps_ui_v3)}  ui-pyth ${b(row.bps_ui_pyth)}`
    );
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(OUT_DIR, `${ASSET.toLowerCase()}-${stamp}.jsonl`);
    const out = fs.createWriteStream(file, { flags: 'a' });

    console.log(`[price-audit] asset=${ASSET} agent=${AGENT_URL} interval=${INTERVAL_MS}ms` +
        `${DURATION_MS ? ` duration=${DURATION_MS}ms` : ' (until Ctrl+C)'}`);
    console.log(`[price-audit] writing -> ${file}\n`);

    let count = 0;
    const startedAt = Date.now();
    let stopping = false;

    const finish = () => {
        if (stopping) return;
        stopping = true;
        out.end();
        console.log(`\n[price-audit] done. ${count} samples -> ${file}`);
        console.log(`[price-audit] analyze with: ./node_modules/.bin/tsx audit/analyze.ts "${file}"`);
        process.exit(0);
    };
    process.on('SIGINT', finish);
    process.on('SIGTERM', finish);

    // Run the first tick immediately, then on the interval.
    while (!stopping) {
        await tick(out).catch(e => console.error('[price-audit] tick error:', e.message));
        count++;
        if (DURATION_MS && Date.now() - startedAt >= DURATION_MS) return finish();
        await new Promise(r => setTimeout(r, INTERVAL_MS));
    }
}

main().catch(e => { console.error(e); process.exit(1); });
