/**
 * Price-audit analyzer.
 *
 * Reads a JSONL file produced by price-audit.ts and reports the accuracy & freshness of the
 * agent's UI price vs each reference (Jupiter Price API v3 and Pyth). Writes REPORT.md + a
 * flattened CSV next to the input, and prints a summary.
 *
 *   ./node_modules/.bin/tsx audit/analyze.ts [path/to/file.jsonl]
 * With no arg, analyzes the newest *.jsonl in audit/data.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function resolveInput(): string {
    const arg = process.argv[2];
    if (arg) return path.resolve(arg);
    const dir = path.join(HERE, 'data');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.jsonl')) : [];
    if (!files.length) { console.error('No .jsonl found in audit/data — pass a file path.'); process.exit(1); }
    files.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
    return path.join(dir, files[0]!);
}

interface Row {
    tsMs: number; asset: string;
    ui: number | null; uiAgeMs: number | null; uiStale: boolean | null; uiReqMs: number | null;
    v3: number | null; pyth: number | null; pythAgeMs: number | null;
    bps_ui_v3: number | null; bps_ui_pyth: number | null; bps_v3_pyth: number | null;
    errors: { agent: string | null; v3: string | null; pyth: string | null };
}

const pct = (arr: number[], p: number): number => {
    if (!arr.length) return NaN;
    const s = [...arr].sort((x, y) => x - y);
    const i = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
    return s[i]!;
};
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const std = (a: number[]) => { if (a.length < 2) return NaN; const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const f2 = (n: number) => (isNaN(n) ? 'n/a' : n.toFixed(2));
const f3 = (n: number) => (isNaN(n) ? 'n/a' : n.toFixed(3));

// Pearson correlation of |error| against staleness — does an older cache read worse?
function corr(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 3) return NaN;
    const mx = mean(x.slice(0, n)), my = mean(y.slice(0, n));
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { const dx = x[i]! - mx, dy = y[i]! - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    return sxx === 0 || syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy);
}

interface RefStats {
    name: string; n: number;
    meanAbs: number; median: number; p90: number; p95: number; p99: number; max: number; std: number;
    bias: number; within5: number; within10: number; within25: number; corrAgeErr: number;
}

function refStats(name: string, rows: Row[], key: 'bps_ui_v3' | 'bps_ui_pyth'): RefStats {
    const paired = rows.filter(r => r[key] !== null);
    const signed = paired.map(r => r[key] as number);
    const abs = signed.map(Math.abs);
    const ages = paired.map(r => r.uiAgeMs ?? 0);
    const within = (t: number) => (abs.length ? (100 * abs.filter(v => v <= t).length / abs.length) : NaN);
    return {
        name, n: paired.length,
        meanAbs: mean(abs), median: pct(abs, 50), p90: pct(abs, 90), p95: pct(abs, 95), p99: pct(abs, 99),
        max: abs.length ? Math.max(...abs) : NaN, std: std(signed),
        bias: mean(signed), within5: within(5), within10: within(10), within25: within(25),
        corrAgeErr: corr(ages, abs),
    };
}

function main() {
    const input = resolveInput();
    const rows: Row[] = fs.readFileSync(input, 'utf8').split('\n').filter(Boolean)
        .map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as Row[];
    if (!rows.length) { console.error('File has no valid rows.'); process.exit(1); }

    const span = (rows[rows.length - 1]!.tsMs - rows[0]!.tsMs) / 1000;
    const uiOk = rows.filter(r => r.ui !== null).length;
    const v3Ok = rows.filter(r => r.v3 !== null).length;
    const pyOk = rows.filter(r => r.pyth !== null).length;
    const staleN = rows.filter(r => r.uiStale).length;
    const ages = rows.filter(r => r.uiAgeMs !== null).map(r => r.uiAgeMs as number);

    const v3 = refStats('Jupiter Price API v3 (spot mint)', rows, 'bps_ui_v3');
    const py = refStats('Pyth oracle (apples-to-apples)', rows, 'bps_ui_pyth');

    const statLines = (s: RefStats) => [
        `**${s.name}** — n=${s.n}`,
        '',
        '| métrica | bps |',
        '|---|---|',
        `| error medio \\|abs\\| | ${f2(s.meanAbs)} |`,
        `| mediana (p50) | ${f2(s.median)} |`,
        `| p90 | ${f2(s.p90)} |`,
        `| **p95** | **${f2(s.p95)}** |`,
        `| p99 | ${f2(s.p99)} |`,
        `| máx | ${f2(s.max)} |`,
        `| sesgo (media con signo) | ${f2(s.bias)} |`,
        `| desviación estándar | ${f2(s.std)} |`,
        `| % muestras ≤ 5 bps | ${f2(s.within5)}% |`,
        `| % muestras ≤ 10 bps | ${f2(s.within10)}% |`,
        `| % muestras ≤ 25 bps | ${f2(s.within25)}% |`,
        `| correlación staleness↔error | ${f3(s.corrAgeErr)} |`,
        '',
    ].join('\n');

    const report = [
        `# Reporte de auditoría de precio — ${rows[0]!.asset}`,
        '',
        `- Archivo: \`${path.basename(input)}\``,
        `- Muestras: **${rows.length}** en ${(span / 60).toFixed(1)} min (${new Date(rows[0]!.tsMs).toISOString()} → ${new Date(rows[rows.length - 1]!.tsMs).toISOString()})`,
        `- Disponibilidad: UI ${f2(100 * uiOk / rows.length)}% · v3 ${f2(100 * v3Ok / rows.length)}% · Pyth ${f2(100 * pyOk / rows.length)}%`,
        '',
        '## Frescura de la caché del agente (uiAgeMs)',
        '',
        '| métrica | ms |',
        '|---|---|',
        `| mediana | ${f2(pct(ages, 50))} |`,
        `| p95 | ${f2(pct(ages, 95))} |`,
        `| máx | ${ages.length ? f2(Math.max(...ages)) : 'n/a'} |`,
        `| % marcadas \`stale\` | ${f2(100 * staleN / rows.length)}% |`,
        '',
        '## Precisión vs referencias (en basis points, 1 bp = 0,01%)',
        '',
        statLines(py),   // Pyth first: it's the apples-to-apples reference for the perps mark
        statLines(v3),
        '## Cómo leerlo',
        '- **p95** es la métrica de aptitud: "el 95% de las lecturas caen dentro de X bps del oráculo". Para perps, p95 ≤ ~10 bps es señal sana.',
        '- **sesgo** (media con signo): si es claramente ≠ 0, la UI lee sistemáticamente alto/bajo → corregible o explotable.',
        '- **correlación staleness↔error** > ~0.3 indica que la caché vieja degrada la precisión → conviene acortar el intervalo del warmer.',
        '- v3 puede mostrar más error que Pyth si el mint envuelto se despega (esperado en ETH); para el mark de perps, **Pyth manda**.',
        '',
    ].join('\n');

    const base = input.replace(/\.jsonl$/, '');
    fs.writeFileSync(base + '.REPORT.md', report);

    // Flattened CSV for spreadsheets / external charting.
    const cols = ['ts', 'asset', 'ui', 'uiAgeMs', 'uiStale', 'uiReqMs', 'v3', 'pyth', 'pythAgeMs', 'bps_ui_v3', 'bps_ui_pyth', 'bps_v3_pyth'];
    const csv = [cols.join(',')].concat(rows.map(r =>
        [new Date(r.tsMs).toISOString(), r.asset, r.ui, r.uiAgeMs, r.uiStale, r.uiReqMs, r.v3, r.pyth, r.pythAgeMs, r.bps_ui_v3, r.bps_ui_pyth, r.bps_v3_pyth]
            .map(v => (v === null || v === undefined ? '' : v)).join(','))).join('\n');
    fs.writeFileSync(base + '.csv', csv);

    console.log(report);
    console.log(`\n[analyze] wrote ${path.basename(base)}.REPORT.md and .csv`);
}

main();
