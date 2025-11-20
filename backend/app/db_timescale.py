"""Async helper for querying session-anchored aggregates in TimescaleDB."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List

import asyncpg

from .config import OHLC_DB_URL

_TABLE_MAP = {
    "5m": "v_ohlc_5m_stitched",
    "15m": "v_ohlc_15m_stitched",
    "1h": "v_ohlc_1h_stitched",
    "4h": "v_ohlc_4h_stitched",
    "1d": "v_ohlc_1d_stitched",
}

_pool: asyncpg.Pool | None = None
_pool_lock = asyncio.Lock()


async def _get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        async with _pool_lock:
            if _pool is None:
                _pool = await asyncpg.create_pool(OHLC_DB_URL, min_size=1, max_size=5)
    return _pool


async def fetch_ohlc(symbol: str, timeframe: str, start_ms: int, end_ms: int) -> List[Dict[str, Any]]:
    """Return stitched OHLC rows for the requested window."""

    table = _TABLE_MAP.get(timeframe)
    if not table:
        raise ValueError(f"Unsupported timeframe '{timeframe}'.")

    pool = await _get_pool()
    query = f"""
        SELECT
          EXTRACT(EPOCH FROM bucket) * 1000 AS ts_ms,
          open,
          high,
          low,
          close,
          volume
        FROM {table}
        WHERE symbol = $1
          AND bucket >= TO_TIMESTAMP($2 / 1000.0)
          AND bucket <  TO_TIMESTAMP($3 / 1000.0)
        ORDER BY bucket ASC
    """

    async with pool.acquire() as conn:
        records = await conn.fetch(query, symbol.upper(), start_ms, end_ms)

    return [dict(record) for record in records]
