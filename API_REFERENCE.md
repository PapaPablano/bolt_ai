# API Reference: Supabase Edge Functions

This document describes the HTTP contracts for the core Supabase Edge
Functions exposed by this project. All functions are deployed under the
Supabase Functions base URL for your project:

```text
https://<project-ref>.supabase.co/functions/v1/<function-name>
```

Authentication is typically via the Supabase **anon** key in the
`Authorization: Bearer <ANON_KEY>` header.

> For deployment details and a broader overview, see
> `BOLT_DEPLOYMENT.md` and `docs/API_INTEGRATION.md`.

---

## `stock-quote`

Real-time quote and basic market data for a single symbol, backed by the
Alpaca API with caching in the `stock_cache` table.

- **Method**: `POST`
- **URL**: `/functions/v1/stock-quote`
- **Headers**:
  - `Authorization: Bearer <SUPABASE_ANON_KEY>`
  - `Content-Type: application/json`

### Request Body

```json
{
  "symbol": "AAPL"
}
```

- `symbol` (string, required): Ticker symbol (case-insensitive).

### Successful Response

```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "price": 178.45,
  "change": 2.34,
  "changePercent": 1.33,
  "volume": 52300000,
  "high": 180.12,
  "low": 176.22,
  "open": 177.89,
  "previousClose": 176.11,
  "source": "alpaca",
  "cachedAt": "2025-01-01T15:30:00.000Z",
  "bid": 178.40,
  "ask": 178.50,
  "tradeTimestamp": "2025-01-01T15:29:58.123Z",
  "cacheHit": false
}
```

Fields:
- `source`: Always `"alpaca"` for live data.
- `cacheHit`: `true` when served from `stock_cache` within the current
  TTL window.

### Error Responses

- **400 Bad Request**

  ```json
  { "error": "Symbol is required" }
  ```

- **500 Internal Server Error**

  ```json
  { "error": "Failed to fetch from Alpaca: ..." }
  ```

---

## `stock-historical-v3`

Daily OHLCV history for a symbol over a requested range, backed by the
Alpaca stocks or futures APIs and cached into `stock_cache`. Equity data
also feeds the `ml_training_data` table for downstream ML.

- **Method**: `POST`
- **URL**: `/functions/v1/stock-historical-v3`
- **Headers**:
  - `Authorization: Bearer <SUPABASE_ANON_KEY>`
  - `Content-Type: application/json`

### Request Body

```json
{
  "symbol": "AAPL",
  "range": "1mo",
  "instrumentType": "equity"
}
```

Fields:
- `symbol` (string, required): Ticker symbol.
- `range` (string, optional, default `"1mo"`):
  - Supported values: `"1d"`, `"5d"`, `"1mo"`, `"3mo"`, `"6mo"`,
    `"1y"`, `"5y"`.
- `instrumentType` (string, optional, default `"equity"`):
  - `"equity"` or `"future"`.

### Successful Response

```json
{
  "data": [
    {
      "date": "2025-01-02",
      "open": 177.89,
      "high": 180.12,
      "low": 176.22,
      "close": 178.45,
      "volume": 52300000
    }
  ],
  "source": "alpaca:stocks",
  "instrumentType": "equity"
}
```

Notes:
- `date` is returned as `YYYY-MM-DD` (UTC).
- `source` encodes instrument type, e.g. `"alpaca:stocks"` or
  `"alpaca:futures"`.

### Error Responses

- **400 Bad Request**

  ```json
  { "error": "Symbol is required" }
  ```

- **404 Not Found**

  ```json
  { "error": "No historical data available" }
  ```

- **500 Internal Server Error**

  ```json
  {
    "error": "Function failed during execution.",
    "details": "…",
    "stack": "…"
  }
  ```

---

## Other Functions

Additional Supabase Edge Functions (Schwab integration, intraday data,
search, streaming, and ML signals) are documented in:

- `BOLT_DEPLOYMENT.md` → *API Endpoints* section.
- `SCHWAB_API_ENDPOINTS.md` and `SCHWAB_API_TROUBLESHOOTING.md`.

In future, these endpoints can be exported as a full OpenAPI spec; this
file serves as a concise, implementation-accurate reference for the
most heavily used data contracts.
