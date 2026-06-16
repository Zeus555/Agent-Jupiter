# Auditoría de precisión de precio

Mide la precisión y frescura del precio que sirve el agente (`GET /price`, derivado de la UI de
Jupiter Perps = **mark price del oráculo**) contra dos referencias independientes:

- **Jupiter Price API v3** — precio spot USD del *mint* (lo solicitado). Para activos envueltos
  (wBTC, wormhole-ETH) puede desviarse del oráculo por despegue del token; trátalo como informativo.
- **Pyth** — la familia de oráculos de la que Perps deriva su mark. Es la referencia
  *apples-to-apples* y la que manda para juzgar el mark de perps.

No toca el camino de trading: solo lee `/price` (lectura de caché, sin lock).

## Uso

```bash
# Muestreo (desde la raíz del proyecto). Corre hasta Ctrl+C.
AGENT_URL=http://192.168.1.91:3011 ./node_modules/.bin/tsx audit/price-audit.ts

# Corrida acotada (p.ej. 1 hora, cada 5 s)
AGENT_URL=http://localhost:3011 AUDIT_INTERVAL_MS=5000 AUDIT_DURATION_MS=3600000 \
  ./node_modules/.bin/tsx audit/price-audit.ts

# Reporte (sin arg = analiza el .jsonl más reciente en audit/data)
./node_modules/.bin/tsx audit/analyze.ts [audit/data/wbtc-XXXX.jsonl]
```

### Variables de entorno
| var | default | descripción |
|---|---|---|
| `AGENT_URL` | `http://localhost:3011` | base del agente |
| `AUDIT_ASSET` | `WBTC` | activo a auditar (WBTC/SOL/ETH; ver nota) |
| `AUDIT_INTERVAL_MS` | `5000` | periodo de muestreo |
| `AUDIT_DURATION_MS` | `0` | 0 = hasta Ctrl+C |
| `AUDIT_OUT_DIR` | `audit/data` | carpeta de salida JSONL |

> **Nota de alcance:** audita **WBTC** (el mercado que el agente mantiene caliente). Pedir SOL/ETH
> hace navegar la única pestaña y genera el churn que justamente degrada la precisión; audítalos
> solo en corridas cortas y controladas, asumiendo esa navegación.

## Salida
- `audit/data/<asset>-<ts>.jsonl` — una muestra por línea (ambos precios, `ageMs`, latencias, bps).
- `*.REPORT.md` — métricas (p50/p90/**p95**/p99, sesgo, % dentro de tolerancia, frescura,
  correlación staleness↔error, disponibilidad).
- `*.csv` — filas planas para hoja de cálculo / graficado externo.

## Cómo interpretar
- **p95 vs Pyth** = aptitud de la señal. Para perps, p95 ≤ ~10 bps = sano.
- **sesgo** ≠ 0 → la UI lee sistemáticamente alto/bajo.
- **correlación staleness↔error** > ~0.3 → la caché vieja degrada precisión (acortar warmer).

## Siguiente fase (guardrail continuo)
Convertir el sampler en un job permanente que registre bps y **alerte** cuando la divergencia
UI↔Pyth supere una tolerancia (detecta precio degradado *antes* de operar). Exponer el último bps
en `/health`.
