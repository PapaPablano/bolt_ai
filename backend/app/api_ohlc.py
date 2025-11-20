"""REST endpoint for fetching stitched OHLC history from Timescale."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from .config import ALLOWED_TFS
from .db_timescale import fetch_ohlc

router = APIRouter(prefix="/ohlc", tags=["ohlc"])

TF = Literal["1m", "5m", "10m", "15m", "1h", "4h", "1d"]


@router.get("")
async def get_ohlc(
    symbol: str = Query(..., min_length=1, max_length=16),
    tf: TF = Query(..., description="Timeframe (1m,5m,10m,15m,1h,4h,1d)"),
    start: int = Query(..., description="Start timestamp in UNIX milliseconds"),
    end: int = Query(..., description="End timestamp in UNIX milliseconds"),
):
    symbol_upper = symbol.upper()

    if tf not in ALLOWED_TFS:
        raise HTTPException(status_code=400, detail=f"Unsupported tf '{tf}'.")
    if end <= start:
        raise HTTPException(status_code=400, detail="'end' must be greater than 'start'.")

    bars = await fetch_ohlc(symbol_upper, tf, start, end)
    return {"symbol": symbol_upper, "tf": tf, "bars": bars}
