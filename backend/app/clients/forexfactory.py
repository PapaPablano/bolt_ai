"""Client for fetching and normalizing ForexFactory economic calendar data."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, TypedDict

import httpx

from ..core.settings import settings


class RawEvent(TypedDict, total=False):
    id: str
    time: str | int  # ISO or epoch
    title: str
    country: str
    currency: str
    impact: str  # "Low"/"Medium"/"High"
    actual: str | None
    forecast: str | None
    previous: str | None
    revised: str | None
    url: str | None


def _to_epoch_seconds(ts: str | int) -> int:
    if isinstance(ts, int):
        return ts
    # accept "2025-11-21T13:30:00Z" etc.
    return int(datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp())


def _norm_impact(s: Optional[str]) -> str:
    if not s:
        return "unknown"
    s = s.strip().lower()
    if s.startswith("h"):
        return "high"
    if s.startswith("m"):
        return "medium"
    if s.startswith("l"):
        return "low"
    return "unknown"


def _headers() -> Dict[str, str]:
    key = settings.JBLANKED_API_KEY or ""
    # The API may accept either Bearer or x-api-key; support both
    return {
        "Authorization": f"Bearer {key}",
        "x-api-key": key,
        "Accept": "application/json",
    }


async def fetch_calendar(
    start: int,
    end: int,
    countries: List[str] | None = None,
    min_impact: str | None = None,
) -> List[Dict[str, Any]]:
    params: Dict[str, Any] = {
        "start": start,
        "end": end,
    }
    if countries:
        params["countries"] = ",".join(countries)
    if min_impact:
        params["min_impact"] = min_impact

    url = f"{settings.JBLANKED_BASE_URL}/calendar"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, params=params, headers=_headers())
        resp.raise_for_status()
        data: List[RawEvent] = resp.json()

    events: List[Dict[str, Any]] = []
    for ev in data:
        t = _to_epoch_seconds(ev.get("time")) if ev.get("time") else None
        if not t:
            continue
        impact = _norm_impact(ev.get("impact"))
        events.append(
            {
                "id": str(ev.get("id") or f"ff-{t}-{ev.get('title', '')}"),
                "source": "forexfactory",
                "ts": t,
                "title": ev.get("title") or "",
                "country": ev.get("country") or "",
                "currency": ev.get("currency") or "",
                "impact": impact,
                "actual": ev.get("actual"),
                "forecast": ev.get("forecast"),
                "previous": ev.get("previous"),
                "revised": ev.get("revised"),
                "url": ev.get("url"),
            }
        )

    if min_impact:
        order = {"low": 0, "medium": 1, "high": 2}
        floor = order.get(min_impact, 0)
        events = [e for e in events if order.get(e["impact"], 0) >= floor]
    return events
