"""Session-anchored OHLCV endpoint with live head stitching."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List

import pandas as pd
import pytz
from fastapi import APIRouter, HTTPException, Query

from .db import db

router = APIRouter(prefix="/api", tags=["ohlcv"])

NY_TZ = pytz.timezone("America/New_York")
UTC = pytz.UTC

DEFAULT_LOOKBACK = timedelta(days=365)
EXPECTED_COLUMNS = ("time", "open", "high", "low", "close", "volume")

VIEW_MAP = {
    "1m": "stock_prices_1m_rth",
    "5m": "stock_prices_5m_rth",
    "15m": "stock_prices_15m_rth",
    "1h": "stock_prices_1h_rth",
    "4h": "stock_prices_4h_rth",
    "1d": "stock_prices_1d_rth",
}


@router.get("/ohlcv/{symbol}")
async def get_ohlcv_with_live_head(
    symbol: str,
    timeframe: str = Query(..., pattern=r"^(1m|5m|15m|1h|4h|1d)$"),
    start: datetime | None = None,
    end: datetime | None = None,
) -> Dict[str, Any]:
    """
    Return session-anchored OHLCV candles with the live (incomplete) bar stitched
    onto the historical continuous aggregate output.
    """
    view_name = VIEW_MAP.get(timeframe)
    if view_name is None:
        raise HTTPException(status_code=400, detail=f"Unsupported timeframe '{timeframe}'.")

    now_ny = datetime.now(NY_TZ)
    start_ny = _ensure_ny_timezone(start) or now_ny - DEFAULT_LOOKBACK
    end_ny = _ensure_ny_timezone(end)

    live_bucket_start = get_current_bucket_start(now_ny, timeframe)

    # Determine the cutoff for historical data and whether to include live ticks.
    include_live = True
    historical_end_ny = live_bucket_start
    if end_ny and end_ny <= live_bucket_start:
        include_live = False
        historical_end_ny = end_ny

    if historical_end_ny <= start_ny:
        return _empty_response(symbol, timeframe, now_ny)

    historical_df = await db.fetch_df(
        f"""
        SELECT
            bucket AT TIME ZONE 'America/New_York' AS time,
            open,
            high,
            low,
            close,
            volume
        FROM {view_name}
        WHERE symbol = $1
          AND bucket >= $2
          AND bucket < $3
        ORDER BY bucket ASC
        """,
        symbol.upper(),
        start_ny.astimezone(UTC),
        historical_end_ny.astimezone(UTC),
        columns=EXPECTED_COLUMNS,
    )

    historical_df = _prepare_historical_df(historical_df)

    live_records: List[Dict[str, Any]] = []
    live_window_end = end_ny if end_ny and end_ny < now_ny else now_ny
    if include_live and live_window_end > live_bucket_start:
        live_df = await db.fetch_df(
            """
            SELECT
                time AT TIME ZONE 'America/New_York' AS time,
                open,
                high,
                low,
                close,
                volume
            FROM stock_prices
            WHERE symbol = $1
              AND time >= $2
              AND time < $3
            ORDER BY time ASC
            """,
            symbol.upper(),
            live_bucket_start.astimezone(UTC),
            live_window_end.astimezone(UTC),
            columns=EXPECTED_COLUMNS,
        )

        if not live_df.empty:
            live_df["time"] = live_df["time"].apply(_localize_time)
            live_bar = {
                "time": live_bucket_start,
                "open": live_df.iloc[0]["open"],
                "high": live_df["high"].max(),
                "low": live_df["low"].min(),
                "close": live_df.iloc[-1]["close"],
                "volume": live_df["volume"].sum(),
                "bar_closed": False,
            }
            live_records = [live_bar]

    result_df = _stitch_results(historical_df, live_records)
    data = _serialize_records(result_df)

    return {
        "symbol": symbol.upper(),
        "timeframe": timeframe,
        "data": data,
        "last_update": now_ny.isoformat(),
        "session_anchored": True,
    }


def get_current_bucket_start(now_ny: datetime, timeframe: str) -> datetime:
    """Calculate session-anchored bucket start for the provided timeframe."""
    market_open = now_ny.replace(hour=9, minute=30, second=0, microsecond=0)

    if timeframe == "1m":
        return now_ny.replace(second=0, microsecond=0)

    if timeframe in {"5m", "15m"}:
        interval = 5 if timeframe == "5m" else 15
        minutes_since_open = max(0, int((now_ny - market_open).total_seconds() // 60))
        bucket_num = minutes_since_open // interval
        return market_open + timedelta(minutes=bucket_num * interval)

    if timeframe == "1h":
        bucket = now_ny.replace(minute=0, second=0, microsecond=0)
        return bucket if bucket >= market_open else market_open

    if timeframe == "4h":
        first_bucket = market_open
        second_bucket = market_open.replace(hour=13, minute=30)
        if now_ny < second_bucket:
            return first_bucket
        return second_bucket

    if timeframe == "1d":
        return market_open

    raise ValueError(f"Unsupported timeframe '{timeframe}'.")


def _ensure_ny_timezone(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return NY_TZ.localize(dt)
    return dt.astimezone(NY_TZ)


def _localize_time(value: Any) -> datetime:
    if isinstance(value, pd.Timestamp):
        value = value.to_pydatetime()
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return NY_TZ.localize(value)
        return value.astimezone(NY_TZ)
    raise TypeError(f"Unsupported time value {value!r}")


def _prepare_historical_df(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    df["time"] = df["time"].apply(_localize_time)
    df["bar_closed"] = True
    return df


def _stitch_results(historical_df: pd.DataFrame, live_records: List[Dict[str, Any]]) -> pd.DataFrame:
    if historical_df.empty and not live_records:
        return historical_df
    frames: List[pd.DataFrame] = []
    if not historical_df.empty:
        frames.append(historical_df)
    if live_records:
        frames.append(pd.DataFrame(live_records))
    return pd.concat(frames, ignore_index=True)


def _serialize_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    if df.empty:
        return []
    records: List[Dict[str, Any]] = []
    for row in df.to_dict("records"):
        ts = row.get("time")
        if isinstance(ts, pd.Timestamp):
            ts = ts.to_pydatetime()
        if isinstance(ts, datetime):
            row["time"] = ts.isoformat()
        records.append(row)
    return records


def _empty_response(symbol: str, timeframe: str, now_ny: datetime) -> Dict[str, Any]:
    return {
        "symbol": symbol.upper(),
        "timeframe": timeframe,
        "data": [],
        "last_update": now_ny.isoformat(),
        "session_anchored": True,
    }
