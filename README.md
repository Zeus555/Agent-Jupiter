# PRC Agent Jupiter

**An RPA-as-a-service that trades and reads prices directly from the public [Jupiter Perpetuals](https://jup.ag/perps) interface — capturing the *real oracle* mark price with ~45× more accuracy than the public v3 API, and executing automated trades when external feeds can't be trusted.**

> When you don't control the resources of the system you operate on, a well-built RPA is the only source that sees *exactly what the market sees*. This project demonstrates, with data, that the difference translates into faster, more accurate decisions — and in markets, that is an edge.

---

## The problem

Trading on a platform you **don't own** leaves you two poor options to feed your decisions:

1. **Its public APIs.** For Jupiter, the *Price API v3* returns the **spot price of the wrapped token** (e.g. wBTC on Solana), not the **oracle mark price** that actually governs the perpetuals — the one that drives your entries, your PnL and your liquidations. That spot price **drifts systematically** from the oracle.
2. **External oracles / third-party aggregators.** Useful, but they add latency, another trust surface, and again **don't necessarily match what the platform uses internally**.

The result: if you make perps decisions on a feed that isn't the real mark, you trade with a constant bias. A *directional* bias — not random noise — is the worst thing for a strategy, because it **doesn't average to zero**: it shifts *every* trade in the same direction.

## The solution: RPA as a service

Instead of guessing the price from the outside, the agent **reads it exactly where a human reads it**: the Jupiter Perpetuals interface itself, rendered in a real browser driven by automation (Playwright + headful Chromium with the Phantom wallet loaded as an extension).

This turns the public UI — something you **don't control** — into a **reliable, operable source of truth**:

- **Reads the oracle mark price** exactly as the platform shows it (not an external proxy).
- **Executes real operations** (open/close/modify positions, TP/SL) by signing with the wallet, just like a person would.
- **Serves that price over a REST API** in milliseconds, for your strategy to consume.

This is **RPA (Robotic Process Automation) as a service**: it automates the human process of "watch the screen and trade" on a system whose resources you don't own, and exposes it as a reliable internal service.

## Measured result: accuracy

We audited the agent's price against two references over 1 hour (639 samples, 5 s interval, WBTC market), using the **Pyth oracle as the benchmark** (the oracle family Perps derives its mark from — an apples-to-apples comparison):

| \|abs\| error vs oracle | **Agent (UI)** | **v3 API** | Agent advantage |
|---|---|---|---|
| mean | **0.36 bps** | 16.05 bps | **44.8× more accurate** |
| median (p50) | 0.18 bps | 15.02 bps | ~83× |
| **p95** | **1.52 bps** | 28.21 bps | **18.6× more accurate** |
| max | 3.23 bps | 33.77 bps | ~10× |
| **bias** (signed) | **+0.06 bps** (none) | **+16.13 bps** (systematic) | — |

*(1 bp = 0.01%.)*

**Reading:**
- The agent tracks the oracle **within ~1.5 bps 95% of the time, with no bias**: its error is tiny symmetric noise centered on the real mark.
- The v3 API carries a **constant +16 bps bias** (the wrapped token trades below the oracle). For perps, that is pure, directional error.
- The agent's cache stays fresh: **median 527 ms, 0% of reads flagged stale**, and **no correlation between staleness and error** (freshness does not degrade accuracy).

> The audit method is reproducible and included in this repo (see [`audit/`](audit/README.md)). The "~45× more accurate" claim is not marketing — it is measurable.

## Why it matters: the competitive edge

In trading, edge compounds as **accuracy × speed**:

- **Accuracy** → better statistics → cleaner signals → higher probability of getting the prediction right.
- **Speed** → the price is served from an in-memory cache in **milliseconds**, without locking the page, so your strategy decides and acts sooner.

A competitor deciding on the **real mark** in **less time** operates with a structural advantage over one using a biased or slow feed. Trade after trade, that advantage compounds into **higher win rates**. This trading case is a concrete example of a general idea:

> **When a system's best source of truth lives in its interface, a well-built RPA can turn that interface into a private API of higher quality than the provider's own public API.**

## How it works (architecture)

```
                      ┌─────────────────────────────────────────────────────────┐
   Your strategy      │  Container (Ubuntu + Xvfb, no desktop)                   │
   ───GET /price───►  │                                                          │
   ◄── price (ms) ──  │   Express API (3011)                                     │
   ──POST /trade──►   │      │                                                   │
                      │      ├─ Price Warmer  ──┐                                │
                      │      │  (in-memory       │   Playwright (headful Chromium)│
                      │      │   cache, no lock   └──►  jup.ag/perps  ◄─ Phantom  │
                      │      │   → ms)                  (reads oracle Mark Price) │
                      │      │                                                    │
                      │      └─ Wallet management ──► visual noVNC session (6080) │
                      └─────────────────────────────────────────────────────────┘
```

Key pieces (in [`src/`](src/)):

- **`index.ts`** — REST API (Express): price, trading, balance, wallet management, health, Swagger at `/api-docs`.
- **`jupiter.ts`** — the **price warmer**: a background loop that keeps a price cache hot by reading the *Mark Price* from the UI, so `GET /price` answers in **milliseconds without touching the browser**. Includes `getCurrentMarket()` (parses the `SOL-<MARKET>` pair from the URL, the reliable signal of the displayed market) and a *maintenance mode* that pauses the warmer during wallet operations.
- **`browser.ts`** — browser lifecycle (cross-platform; profile-lock cleanup, launch retries).
- **`phantom.ts`** — Phantom wallet automation (import/activate, unlock).
- **`vnc.ts`** — on-demand visual **noVNC** session for wallet onboarding (Phantom's MV3 popups don't render reliably headless; they're completed by hand, once, through the browser).
- **`mutex.ts`** — a *page lock* so the warmer and trading never fight over the browser (trading always wins).

**Design constraint:** the browser uses **at most two tabs** (Jupiter + Phantom). The price is **always** read from the interface, never from an external API — that is precisely the reason for its accuracy.

## API (overview)

Full interactive docs at **`/api-docs`** (Swagger). Main endpoints:

| Method | Path | Description |
|---|---|---|
| `GET` | `/price?asset=WBTC` | Oracle mark price (served from cache, with `ageMs`/`stale`) |
| `GET` | `/wallet/balance` | Wallet balances |
| `POST` | `/trade/long` · `/trade/short` | Open a position |
| `POST` | `/trade/close` | Close positions |
| `POST` | `/trade/update` | Modify TP/SL |
| `GET` | `/trade/estimate` · `/trade/info` · `/trade/history` | Estimate / open positions / history |
| `GET` | `/wallet/status` | Active wallet and connection state |
| `POST` | `/wallet/import` · `/wallet/forget` | Change / remove wallet (requires `X-API-Key`) |
| `POST` | `/wallet/onboard-session[/close]` | Visual noVNC session to create/connect a wallet (requires `X-API-Key`) |
| `GET` | `/health` | Liveness + warmer status |

Wallet-mutating endpoints are protected with `X-API-Key` (fail-closed).

## Deployment

Designed to run **isolated in Docker** on Linux (no VT-x required: Linux containers use namespaces/cgroups). Headful Chromium runs under `Xvfb` (a virtual display).

```bash
cp .env.example .env          # set PHANTOM_PASSWORD, WALLET_API_KEY, etc.
docker compose up -d --build  # API on :3011, Swagger on :3011/api-docs
```

For a fresh host, [`deploy/setup-ubuntu.sh`](deploy/setup-ubuntu.sh) installs Docker + compose, creates swap and brings the service up. Detailed guide in [`DOCKER.md`](DOCKER.md).

The wallet is connected once via the **visual noVNC session** (`POST /wallet/onboard-session` → URL + one-time password → you connect Phantom by hand). From then on, the agent **reconnects on its own** after restarts (Jupiter remains a trusted app in Phantom).

## Reproduce the accuracy audit

The full harness lives in [`audit/`](audit/):

```bash
# Sample agent vs Jupiter v3 vs Pyth (oracle), one JSONL line per sample
AGENT_URL=http://localhost:3011 ./node_modules/.bin/tsx audit/price-audit.ts

# Generate the report (p50/p90/p95/p99, bias, % within tolerance, freshness, availability)
./node_modules/.bin/tsx audit/analyze.ts
```

## Security

- Recovery phrases are **never** logged or returned. The seed, if generated, is stored with `0600` permissions and outside the repo.
- Secrets (`.env`), wallet state (`user_data/`), seeds and screenshots are in `.gitignore` — **verify nothing sensitive is staged before publishing**.
- Sensitive endpoints require `X-API-Key`.

## Disclaimer

Software for educational and research purposes in automation (RPA) and for use on your own accounts. Automated trading carries **real financial risk**; using third-party interfaces may be subject to their Terms of Service. Use at your own risk.

---

*Stack: TypeScript · Node · Express · Playwright · Docker · Solana / Jupiter Perpetuals · Phantom.*
