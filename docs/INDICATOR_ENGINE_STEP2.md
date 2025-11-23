---
description: IndicatorEngine Step 2 architecture
---

# IndicatorEngine – Step 2 Architecture Note

This note sketches the next iteration of the IndicatorEngine once the workerized, decimated indicators in the chart are stable.

## 1. Requirements

- **Deterministic indicators**
  - Inputs: symbol (e.g. `AAPL`), timeframe (TF), indicator name(s), and parameter sets.
  - Outputs: UTC-timestamped series aligned to OHLCV bars, with metadata and health flags.
- **Separation of concerns**
  - Chart stays a consumer; IndicatorEngine becomes the owner of calculation, caching, and backfill policy.
  - Engine is callable from both HTTP (`/indicators/:symbol/:tf`) and background jobs.
- **Performance + SLOs**
  - P99 API latency budget: **< 100 ms** for cached requests, **< 400 ms** for cold paths.
  - Supports at least tens of concurrent symbols × TFs without saturating Timescale.
- **Financial constraints**
  - All timestamps stored/served as **UTC**.
  - No `float` leakage into financial calculations; callers are responsible for `Decimal`/`Big.js` at the edges.

## 2. Indicator Registry

Goal: single source of truth for indicator implementations and metadata.

- **Registry shape** (conceptual TypeScript):

  ```ts
  type Tf = '1Min' | '5Min' | '15Min' | '1Hour' | '4Hour' | '1Day';

  type IndicatorKey = `${string}:${Tf}:${string}`; // symbol:tf:indicator

  interface IndicatorDefinition {
    name: string; // e.g. 'stperf', 'ema', 'rsi', 'kdj'
    version: string; // bump on breaking param/logic changes
    paramsSchema: unknown; // zod schema or JSON-schema
    windowSize: number; // min bars required
    compute: (bars: OhlcvBar[], params: Record<string, unknown>) => IndicatorResult;
  }

  type IndicatorRegistry = Map<string, IndicatorDefinition>;
  ```

- **Responsibilities**
  - Provide lookup by `(indicatorName, version)`.
  - Expose minimum history window for each TF (e.g. MACD 26, KDJ period 9).
  - Carry **stable IDs** used in Redis cache keys and response metadata.

- **Trade-offs**
  - Keeping the registry in-process (Node or Deno) is simple, but scaling to multiple services requires either code reuse or publishing an `indicator-engine` package.
  - Avoid dynamic `eval`/plugin loading for now; static registration is safer and easier to reason about.

## 3. Redis Caching Strategy

We assume:
- TimescaleDB is the authoritative store for OHLCV and long-horizon indicators.
- Redis is a **read-through cache** for precomputed indicator payloads.

### 3.1 Key Design

- **Key pattern**

  ```
  indicator:{symbol}:{tf}:{indicatorName}:v{version}
  ```

  - `symbol`: uppercased (e.g. `AAPL`).
  - `tf`: exact TF token (e.g. `1Min`, `1Day`).
  - `indicatorName`: short code (`stperf`, `ema`, `rsi`, `kdj`, `vwap`).
  - `version`: registry version string; bumping invalidates old cache segments.

- **Value**
  - JSON blob containing:
    - `series`: compressed timeseries (`[timeSec, value]` pairs; UTC seconds).
    - `meta`: params hash, sample count, last updated time, source range, and health flags.

- **TTL / expiry**
  - Intraday TFs (`1Min`, `5Min`, `15Min`, `1Hour`, `4Hour`): short TTL (e.g. 60–120 seconds).
  - Daily TF (`1Day`): longer TTL (e.g. 30–60 minutes) because bars change less often.
  - Optional **sliding TTL** for hot keys via `EXPIRE` on update.

### 3.2 Read/Write Path

1. **Read path (HTTP handler pseudo-code)**

   ```ts
   const key = makeKey(symbol, tf, indicatorName, version);
   const cached = await redis.get(key);
   if (cached) return JSON.parse(cached);

   const bars = await loadBarsFromTimescale(symbol, tf, rangeHint);
   const def = registry.get(indicatorName);
   const result = def.compute(bars, params);

   const payload = serializeIndicatorResult(result, def, symbol, tf, params);
   await redis.set(key, JSON.stringify(payload), 'EX', ttlFor(tf));
   return payload;
   ```

2. **Write/backfill path**
   - Background job iterates over active `(symbol, tf, indicator)` combos.
   - Refreshes hot keys on a schedule (e.g. every 30–60 seconds for active intraday symbols).
   - Optionally uses **pipeline** / **batch writes** to Redis for better throughput.

### 3.3 Invalidation

- **Version-based**: bump `IndicatorDefinition.version` when logic/params change → new keys.
- **Symbol events** (e.g. splits): push an invalidation message to a queue; worker deletes cache keys for affected symbol/TFs.
- **Emergency flush**: namespaced prefixes (`indicator:{symbol}:*`) enable coarse invalidation when needed.

## 4. `/indicators/:symbol/:tf` API Contract

### 4.1 Request

- **Method**: `GET`
- **Path**: `/indicators/:symbol/:tf`
- **Path params**:
  - `symbol` – ticker symbol, case-insensitive, normalized to upper-case.
  - `tf` – timeframe token matching registry TFs.
- **Query params**:
  - `names` – comma-separated indicator names, e.g. `names=stperf,ema,rsi`.
  - `from`, `to` – optional UTC seconds bounding the requested range (server may extend for windowSize).
  - `params[name]` – optional JSON-encoded parameter overrides per indicator (or use body in POST variant).

### 4.2 Response

- **Status codes**
  - `200` – success.
  - `400` – validation error (unknown TF/indicator, bad symbol, invalid params).
  - `404` – symbol/TF combination unavailable.
  - `500` – unexpected engine/db failure.

- **Body** (conceptual schema):

  ```jsonc
  {
    "symbol": "AAPL",
    "timeframe": "1Min",
    "from": 1731542400,
    "to": 1731546000,
    "indicators": {
      "stperf": {
        "version": "1.0.0",
        "params": { "atrSpan": 14, "factorMin": 1.5, "factorMax": 4 },
        "series": [[1731542400, 1.23], [1731542460, 1.21]],
        "meta": { "source": "timescale", "sampleCount": 390 }
      },
      "ema": {
        "version": "1.0.0",
        "params": { "span": 20 },
        "series": [[1731542400, 189.12], [1731542460, 189.34]],
        "meta": { "source": "timescale", "sampleCount": 390 }
      }
    }
  }
  ```

- **Headers**
  - `Cache-Control: public, max-age=10` (or `s-maxage` for CDNs) for intraday.
  - `X-Indicator-Source: cache|timescale` – quick signal of hot/cold path.

## 5. Trade-offs & Open Questions

- **Redis vs. Timescale-only**
  - Pros of Redis: predictable low-latency reads for hot indicator sets; protects Timescale from spiky traffic.
  - Cons: extra moving part, eventual consistency; need invalidation discipline.
- **Per-indicator vs. bundled keys**
  - Per-indicator keys → more flexibility but more round trips.
  - Bundling common sets (e.g. `core` = `stperf,ema,rsi,macd`) reduces overhead for charts that always request the same group.
- **Async vs. sync updates**
  - Current design favors synchronous compute on cache miss; we may later migrate to fully async backfill where API always hits Redis and background workers keep it warm.

## 6. Next Steps

1. Implement a minimal Node/Edge function that wires registry + Timescale + Redis for a single TF (e.g. `1Hour`) and a small indicator set.
2. Add integration tests that verify:
   - Cache hit vs. miss behavior and latency.
   - Version-driven key migration.
3. Document the registry + cache behavior in the main architecture docs once the prototype is stable.
