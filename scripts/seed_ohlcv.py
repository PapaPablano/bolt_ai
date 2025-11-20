#!/usr/bin/env python3
"""
Seed the `ohlcv` hypertable with synthetic minute bars for quick local tests.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import random
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from math import floor
from typing import Any, List, Sequence, Tuple
from zoneinfo import ZoneInfo

import asyncpg

NY_TZ = ZoneInfo("America/New_York")
SESSION_START = time(9, 30)
SESSION_END = time(16, 0)
CA_TARGETS = ["ca_1m", "ca_5m", "ca_15m", "ca_1h", "ca_4h", "ca_1d"]

# Minimal holiday list for local tests (extend as needed)
HOLIDAYS = {
    "2024-11-28",  # Thanksgiving
    "2024-12-25",  # Christmas
}

# Early close map (ET). Values are HH:MM tuples for the session end time.
EARLY_CLOSES: dict[str, tuple[int, int]] = {
    "2024-11-29": (13, 0),  # Day after Thanksgiving
}


@dataclass(frozen=True)
class SeederConfig:
    dsn: str
    symbols: Sequence[str]
    trading_days: Sequence[date]
    seed: int | None
    skip_refresh: bool
    batch_size: int
    holiday_aware: bool
    use_copy: bool
    calendar: str
    end_date: date
    day_count: int


def parse_args() -> SeederConfig:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dsn",
        default=os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL"),
        help=(
            "Timescale/Supabase connection string. Defaults to $DATABASE_URL "
            "or $SUPABASE_DB_URL."
        ),
    )
    parser.add_argument(
        "--symbols",
        default="AAPL,MSFT,TSLA,SPY",
        help="Comma-separated list of symbols to seed.",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=3,
        choices=range(1, 8),
        metavar="[1-7]",
        help="Number of most-recent trading days to seed (default: 3).",
    )
    parser.add_argument(
        "--end-date",
        type=lambda value: datetime.strptime(value, "%Y-%m-%d").date(),
        default=datetime.now(NY_TZ).date(),
        help="Last trading day to seed (YYYY-MM-DD, defaults to today).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Optional RNG seed for deterministic prices.",
    )
    parser.add_argument(
        "--skip-refresh",
        action="store_true",
        help="Skip refreshing continuous aggregates after inserts.",
    )
    parser.add_argument(
        "--holiday-aware",
        action="store_true",
        help="Skip a small set of known NYSE holidays when seeding.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=2000,
        help=(
            "Rows per INSERT batch "
            "(default: 2000)."
        ),
    )
    parser.add_argument(
        "--copy",
        dest="use_copy",
        action="store_true",
        help=(
            "Use COPY for bulk inserts (faster, but does not upsert and "
            "may fail if rows already exist)."
        ),
    )
    parser.add_argument(
        "--calendar",
        choices=("auto", "none"),
        default="auto",
        help=(
            "Use an exchange calendar for holidays/early closes (auto) or "
            "static rules (none)."
        ),
    )

    args = parser.parse_args()

    if not args.dsn:
        raise SystemExit("--dsn or DATABASE_URL/SUPABASE_DB_URL must be provided")

    symbols = [
        symbol.strip().upper()
        for symbol in args.symbols.split(",")
        if symbol.strip()
    ]
    if not symbols:
        raise SystemExit("At least one symbol is required")

    trading_days = _most_recent_sessions(
        args.end_date,
        args.days,
        args.holiday_aware,
    )

    return SeederConfig(
        dsn=args.dsn,
        symbols=symbols,
        trading_days=trading_days,
        seed=args.seed,
        skip_refresh=args.skip_refresh,
        batch_size=max(1, args.batch_size),
        holiday_aware=args.holiday_aware,
        use_copy=args.use_copy,
        calendar=args.calendar,
        end_date=args.end_date,
        day_count=args.days,
    )


def _most_recent_sessions(
    end_date: date,
    count: int,
    holiday_aware: bool,
) -> List[date]:
    sessions: List[date] = []
    cursor = end_date
    while len(sessions) < count:
        if holiday_aware and cursor.isoformat() in HOLIDAYS:
            cursor -= timedelta(days=1)
            continue
        if cursor.weekday() < 5:  # Monday = 0
            sessions.append(cursor)
        cursor -= timedelta(days=1)
    sessions.reverse()
    return sessions


def _session_minutes(session_date: date) -> List[datetime]:
    close_hour, close_minute = EARLY_CLOSES.get(
        session_date.isoformat(),
        (SESSION_END.hour, SESSION_END.minute),
    )
    start = datetime.combine(session_date, SESSION_START, tzinfo=NY_TZ)
    end = datetime.combine(
        session_date,
        time(close_hour, close_minute),
        tzinfo=NY_TZ,
    )
    minutes: List[datetime] = []
    current = start
    while current < end:
        minutes.append(current)
        current += timedelta(minutes=1)
    return minutes


def _generate_bars(
    symbol: str,
    session_minutes: Sequence[datetime],
    rng: random.Random,
) -> List[Tuple[str, datetime, float, float, float, float, int]]:
    price = _base_price(symbol)
    bars = []
    for ts in session_minutes:
        open_price = price
        drift = rng.uniform(-0.6, 0.6)
        close_price = max(1.0, open_price + drift)
        high = max(open_price, close_price) + abs(rng.uniform(0.0, 0.35))
        low = max(
            0.01,
            min(open_price, close_price) - abs(rng.uniform(0.0, 0.35)),
        )
        volume = rng.randint(50_000, 2_000_000)
        bars.append(
            (
                symbol,
                ts.astimezone(timezone.utc),
                round(open_price, 4),
                round(high, 4),
                round(low, 4),
                round(close_price, 4),
                volume,
            )
        )
        price = close_price
    return bars


def _floor_to(ms: int, base: int, origin: int = 0) -> int:
    return origin + floor((ms - origin) / base) * base


def _et_anchors_ms(t: datetime) -> Tuple[int, int]:
    """Return (midnight_et_ms, open_et_ms) for the given timestamp."""

    et_midnight = t.astimezone(NY_TZ).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    et_midnight_utc = et_midnight.astimezone(timezone.utc)
    et_open_utc = et_midnight_utc + timedelta(hours=9, minutes=30)
    return (
        int(et_midnight_utc.timestamp() * 1000),
        int(et_open_utc.timestamp() * 1000),
    )


def _align_to_minute_buckets(
    start_ts: datetime,
    end_ts: datetime,
) -> Tuple[datetime, datetime]:
    """Align a [start, end) range to 1m ET buckets for deterministic CA refresh."""

    start_ms = int(start_ts.timestamp() * 1000)
    end_ms = int(end_ts.timestamp() * 1000)
    _, et_open_ms = _et_anchors_ms(start_ts)

    start_aligned_ms = _floor_to(start_ms, 60_000, et_open_ms)
    end_aligned_ms = _floor_to(end_ms, 60_000, et_open_ms) + 60_000

    start_aligned = datetime.fromtimestamp(
        start_aligned_ms / 1000,
        tz=timezone.utc,
    )
    end_aligned = datetime.fromtimestamp(
        end_aligned_ms / 1000,
        tz=timezone.utc,
    )
    return start_aligned, end_aligned


def _align_to_daily_buckets(
    start_ts: datetime,
    end_ts: datetime,
) -> Tuple[datetime, datetime]:
    """Align a [start, end) range to 1d buckets anchored at 00:00 ET."""

    start_et_midnight = start_ts.astimezone(NY_TZ).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    end_et_midnight = end_ts.astimezone(NY_TZ).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    # ensure end is exclusive and covers full last day
    end_et = end_et_midnight + timedelta(days=1)

    return (
        start_et_midnight.astimezone(timezone.utc),
        end_et.astimezone(timezone.utc),
    )


def _base_price(symbol: str) -> float:
    presets = {
        "AAPL": 185.0,
        "MSFT": 350.0,
        "TSLA": 250.0,
        "SPY": 450.0,
    }
    return presets.get(symbol, 100.0 + (hash(symbol) % 300))


def _get_calendar() -> Tuple[str | None, Any | None]:
    """Attempt to load an exchange calendar for NYSE sessions."""

    try:
        import exchange_calendars as xc

        return "xc", xc.get_calendar("XNYS")
    except Exception:
        pass

    try:
        import pandas_market_calendars as mcal

        return "pmc", mcal.get_calendar("NYSE")
    except Exception:
        pass

    return None, None


def _sessions_from_calendar(
    end_date: date,
    count: int,
    cal_kind: str,
    calendar_obj: Any,
) -> List[date]:
    import pandas as pd

    start = end_date - timedelta(days=60)
    if cal_kind == "xc":
        sessions = calendar_obj.sessions_in_range(
            pd.Timestamp(start, tz="UTC"),
            pd.Timestamp(end_date, tz="UTC"),
        )
        session_dates = [ts.date() for ts in sessions]
    elif cal_kind == "pmc":
        schedule = calendar_obj.schedule(
            start_date=start.strftime("%Y-%m-%d"),
            end_date=end_date.strftime("%Y-%m-%d"),
        )
        session_dates = [ts.date() for ts in schedule.index]
    else:
        raise RuntimeError("Unsupported calendar kind")

    if not session_dates:
        return []
    return session_dates[-count:]


def _session_minutes_from_calendar(
    session_date: date,
    cal_kind: str | None,
    calendar_obj: Any,
) -> List[datetime]:
    if cal_kind is None or calendar_obj is None:
        return _session_minutes(session_date)

    import pandas as pd

    if cal_kind == "xc":
        label = pd.Timestamp(session_date, tz="UTC")
        m_open = calendar_obj.session_open(label).tz_convert(NY_TZ)
        m_close = calendar_obj.session_close(label).tz_convert(NY_TZ)
    elif cal_kind == "pmc":
        schedule = calendar_obj.schedule(
            start_date=session_date.strftime("%Y-%m-%d"),
            end_date=session_date.strftime("%Y-%m-%d"),
        )
        if schedule.empty:
            return []
        row = schedule.iloc[0]
        m_open = row["market_open"].tz_convert(NY_TZ)
        m_close = row["market_close"].tz_convert(NY_TZ)
    else:
        return _session_minutes(session_date)

    minutes: List[datetime] = []
    current = m_open
    while current < m_close:
        minutes.append(current)
        current += timedelta(minutes=1)
    return minutes


async def _insert_batches(
    conn: asyncpg.Connection,
    time_column: str,
    rows: Sequence[Tuple[str, datetime, float, float, float, float, int]],
    batch_size: int,
) -> None:
    query = f"""
        INSERT INTO ohlcv (symbol, {time_column}, open, high, low, close, volume)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (symbol, {time_column}) DO UPDATE SET
          open = EXCLUDED.open,
          high = EXCLUDED.high,
          low = EXCLUDED.low,
          close = EXCLUDED.close,
          volume = EXCLUDED.volume
    """
    for start in range(0, len(rows), batch_size):
        end = start + batch_size
        chunk = rows[start:end]
        await conn.executemany(query, chunk)


async def _copy_into_ohlcv(
    conn: asyncpg.Connection,
    time_column: str,
    rows: Sequence[Tuple[str, datetime, float, float, float, float, int]],
) -> None:
    columns = [
        "symbol",
        time_column,
        "open",
        "high",
        "low",
        "close",
        "volume",
    ]
    await conn.copy_records_to_table(
        "ohlcv",
        records=rows,
        columns=columns,
    )


async def _detect_time_column(conn: asyncpg.Connection) -> str:
    """Detect whether the ohlcv hypertable uses `ts` or `time` as the column."""

    column = await conn.fetchval(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'ohlcv'
          AND column_name IN ('ts', 'time')
        ORDER BY CASE column_name WHEN 'time' THEN 0 ELSE 1 END
        LIMIT 1
        """
    )
    if not column:
        raise RuntimeError(
            "Could not find 'ts' or 'time' column on ohlcv hypertable."
        )
    return str(column)


async def _refresh_cas(
    conn: asyncpg.Connection,
    intraday_start: datetime,
    intraday_end: datetime,
    daily_start: datetime,
    daily_end: datetime,
) -> None:
    for ca in CA_TARGETS:
        if ca == "ca_1d":
            start_ts, end_ts = daily_start, daily_end
        else:
            start_ts, end_ts = intraday_start, intraday_end

        await conn.execute(
            "CALL refresh_continuous_aggregate($1::regclass, $2, $3);",
            ca,
            start_ts,
            end_ts,
        )


async def seed_data(config: SeederConfig) -> None:
    rng = random.Random(config.seed)

    cal_kind: str | None = None
    calendar_obj: Any | None = None
    if config.calendar == "auto":
        cal_kind, calendar_obj = _get_calendar()
        if cal_kind is None:
            print("Calendar auto-detect failed; falling back to static schedule.")

    if cal_kind is not None and calendar_obj is not None:
        trading_days = _sessions_from_calendar(
            config.end_date,
            config.day_count,
            cal_kind,
            calendar_obj,
        )
    else:
        trading_days = list(config.trading_days)

    if not trading_days:
        print("No trading sessions resolved; aborting seed.")
        return

    minutes_by_day: dict[date, List[datetime]] = {}
    for day in trading_days:
        if cal_kind is not None and calendar_obj is not None:
            minutes = _session_minutes_from_calendar(day, cal_kind, calendar_obj)
            if not minutes:
                minutes = _session_minutes(day)
        else:
            minutes = _session_minutes(day)
        minutes_by_day[day] = minutes

    all_rows: List[Tuple[str, datetime, float, float, float, float, int]] = []

    for symbol in config.symbols:
        symbol_rng = random.Random(rng.randint(0, 1_000_000))
        for day in trading_days:
            bars = _generate_bars(symbol, minutes_by_day[day], symbol_rng)
            all_rows.extend(bars)

    if not all_rows:
        print("No rows to insert. Check symbol list or trading day range.")
        return

    start_ts = all_rows[0][1]
    end_ts = all_rows[-1][1] + timedelta(minutes=1)
    intraday_start, intraday_end = _align_to_minute_buckets(start_ts, end_ts)
    daily_start, daily_end = _align_to_daily_buckets(start_ts, end_ts)

    conn = await asyncpg.connect(config.dsn)
    try:
        time_column = await _detect_time_column(conn)
        print(
            f"Inserting {len(all_rows):,} rows across "
            f"{len(config.symbols)} symbols..."
        )
        if config.use_copy:
            await _copy_into_ohlcv(conn, time_column, all_rows)
        else:
            await _insert_batches(
                conn,
                time_column,
                all_rows,
                config.batch_size,
            )
        if config.skip_refresh:
            print("Skipping continuous aggregate refresh (per flag).")
        else:
            print("Refreshing continuous aggregates...")
            await _refresh_cas(
                conn,
                intraday_start,
                intraday_end,
                daily_start,
                daily_end,
            )
    finally:
        await conn.close()

    print(
        "Done! Verify with e.g., SELECT count(*) FROM ohlcv "
        "WHERE symbol = 'AAPL';"
    )


def main() -> None:
    config = parse_args()
    asyncio.run(seed_data(config))


if __name__ == "__main__":
    main()
