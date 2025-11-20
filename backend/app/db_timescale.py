"""Async helper for querying session-anchored aggregates in TimescaleDB."""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List

import asyncpg

from .config import OHLC_DB_URL

TABLE_BY_TF: Dict[str, str] = {
    "1m": "v_ohlc_1m_stitched",
    "5m": "v_ohlc_5m_stitched",
    "10m": "v_ohlc_10m_derived_stitched",
    "15m": "v_ohlc_15m_stitched",
    "1h": "v_ohlc_1h_stitched",
    "4h": "v_ohlc_4h_stitched",
    "1d": "v_ohlc_1d_stitched",
}

_pool: asyncpg.Pool | None = None
_pool_lock = asyncio.Lock()


async def get_pool() -> asyncpg.Pool:
    """Create (or return) a singleton asyncpg pool for the Timescale sidecar."""
    global _pool
    if _pool is None:
        async with _pool_lock:
            if _pool is None:
                _pool = await asyncpg.create_pool(dsn=OHLC_DB_URL, min_size=1, max_size=8)
    return _pool


async def fetch_ohlc(
    symbol: str,
    tf: str,
    start_ms: int,
    end_ms: int,
) -> List[Dict[str, Any]]:
    """Return stitched OHLC rows for the requested window."""
    table = TABLE_BY_TF.get(tf)
    if table is None:
        raise ValueError(f"Unsupported timeframe '{tf}'.")

    symbol_upper = symbol.upper()
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT bucket AS ts, open, high, low, close, volume
              FROM {table}
             WHERE symbol = $1
               AND bucket BETWEEN to_timestamp($2/1000.0) AND to_timestamp($3/1000.0)
             ORDER BY bucket ASC
            """,
            symbol_upper,
            start_ms,
            end_ms,
        )

    return [
        {
            "time": int(record["ts"].timestamp() * 1000),
            "open": float(record["open"]),
            "high": float(record["high"]),
            "low": float(record["low"]),
            "close": float(record["close"]),
            "volume": int(record["volume"]),
        }
        for record in rows
    ]


async def fetch_latest(symbol: str, tf: str, limit: int = 5000) -> List[Dict[str, Any]]:
    """Return the most recent stitched rows for sanity checks."""

    table = TABLE_BY_TF.get(tf)
    if table is None:
        raise ValueError(f"Unsupported timeframe '{tf}'.")

    symbol_upper = symbol.upper()
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT bucket AS ts, open, high, low, close, volume
              FROM {table}
             WHERE symbol = $1
             ORDER BY bucket DESC
             LIMIT $2
            """,
            symbol_upper,
            max(1, limit),
        )

    ordered = list(reversed(rows))
    return [
        {
            "time": int(record["ts"].timestamp() * 1000),
            "open": float(record["open"]),
            "high": float(record["high"]),
            "low": float(record["low"]),
            "close": float(record["close"]),
            "volume": int(record["volume"]),
        }
        for record in ordered
    ]
