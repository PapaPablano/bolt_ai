"""Lightweight async helper for querying TimescaleDB/Postgres."""

from __future__ import annotations

import asyncio
import os
from typing import Any, Iterable

import asyncpg
import pandas as pd


class TimescaleDatabase:
    """Async connection pool with helpers that return pandas DataFrames."""

    def __init__(
        self,
        dsn: str | None = None,
        *,
        min_size: int = 1,
        max_size: int = 5,
    ) -> None:
        self._dsn = dsn
        self._min_size = min_size
        self._max_size = max_size
        self._pool: asyncpg.Pool | None = None
        self._lock = asyncio.Lock()

    async def _ensure_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            async with self._lock:
                if self._pool is None:
                    dsn = self._dsn or os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
                    if not dsn:
                        raise RuntimeError(
                            "DATABASE_URL or SUPABASE_DB_URL must be set to query TimescaleDB."
                        )
                    self._pool = await asyncpg.create_pool(
                        dsn,
                        min_size=self._min_size,
                        max_size=self._max_size,
                    )
        return self._pool

    async def fetch_df(
        self,
        query: str,
        *params: Any,
        columns: Iterable[str] | None = None,
    ) -> pd.DataFrame:
        """
        Execute a read-only query and return a DataFrame.

        Args:
            query: SQL statement using asyncpg-style placeholders ($1, $2, ...).
            params: Bound parameter values.
            columns: Optional iterable to enforce column order on empty frames.
        """
        pool = await self._ensure_pool()
        async with pool.acquire() as conn:
            records = await conn.fetch(query, *params)

        if not records:
            return pd.DataFrame(columns=list(columns) if columns is not None else None)

        rows = [dict(record) for record in records]
        df = pd.DataFrame(rows)
        if columns is not None:
            return df.reindex(columns=list(columns))
        return df

    async def close(self) -> None:
        """Close the connection pool (mostly useful for tests)."""
        if self._pool is not None:
            await self._pool.close()
            self._pool = None


db = TimescaleDatabase()

__all__ = ["TimescaleDatabase", "db"]
