from __future__ import annotations

from typing import Any, Dict, List, Optional

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.clients import forexfactory
from backend.app.routers import calendar as calendar_router


class _DummyResponse:
    def __init__(self, data: List[Dict[str, Any]]):
        self._data = data

    def raise_for_status(self) -> None:
        return None

    def json(self) -> List[Dict[str, Any]]:
        return self._data


class _DummyAsyncClient:
    def __init__(self, data: List[Dict[str, Any]]):
        self.data = data
        self.params: Optional[Dict[str, Any]] = None
        self.headers: Optional[Dict[str, Any]] = None

    async def __aenter__(self) -> "_DummyAsyncClient":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False

    async def get(
        self,
        url: str,
        params: Dict[str, Any],
        headers: Dict[str, Any],
    ) -> _DummyResponse:
        self.params = params
        self.headers = headers
        return _DummyResponse(self.data)


@pytest.mark.asyncio
async def test_fetch_calendar_normalizes_and_filters(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = [
        {
            "id": "42",
            "time": "2025-11-21T13:30:00Z",
            "title": "GDP",
            "country": "US",
            "currency": "USD",
            "impact": "High",
            "actual": "3.0%",
        },
        {
            "time": 1_700_000_000,
            "title": "Retail",
            "impact": " medium ",
        },
        {
            "id": "skip",
            "title": "No Time",
            "impact": "Low",
        },
    ]

    created: Dict[str, _DummyAsyncClient] = {}

    def fake_client(*args: Any, **kwargs: Any) -> _DummyAsyncClient:
        client = _DummyAsyncClient(payload)
        created["client"] = client
        return client

    monkeypatch.setattr(forexfactory.httpx, "AsyncClient", fake_client)

    result = await forexfactory.fetch_calendar(
        start=1700000000,
        end=1700003600,
        countries=["US", "EU"],
        min_impact="medium",
    )

    assert len(result) == 2  # low impact filtered, missing time dropped
    assert result[0]["source"] == "forexfactory"
    assert result[0]["ts"] == 1732195800
    assert result[1]["impact"] == "medium"
    assert created["client"].params == {
        "start": 1700000000,
        "end": 1700003600,
        "countries": "US,EU",
        "min_impact": "medium",
    }
    assert "Authorization" in created["client"].headers


def test_calendar_router_uses_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = [
        {
            "id": "evt-1",
            "source": "forexfactory",
            "ts": 1700000000,
            "title": "CPI",
            "impact": "high",
        }
    ]

    cache_store: Dict[str, List[Dict[str, Any]]] = {}
    fetch_calls = {"count": 0}

    async def fake_cache_get(key: str) -> Optional[List[Dict[str, Any]]]:
        return cache_store.get(key)

    async def fake_cache_set(key: str, value: List[Dict[str, Any]]) -> None:
        cache_store[key] = value

    async def fake_fetch(
        start: int,
        end: int,
        countries: Optional[List[str]],
        min_impact: Optional[str],
    ) -> List[Dict[str, Any]]:
        fetch_calls["count"] += 1
        return payload

    monkeypatch.setattr(calendar_router, "_cache_get", fake_cache_get)
    monkeypatch.setattr(calendar_router, "_cache_set", fake_cache_set)
    monkeypatch.setattr(calendar_router, "fetch_calendar", fake_fetch)

    calendar_router._breaker.reset()
    calendar_router._last_good_cache.clear()

    app = FastAPI()
    app.include_router(calendar_router.router)
    client = TestClient(app)

    params = {"start": 1700000000, "end": 1700003600}

    resp1 = client.get("/v1/calendar", params=params)
    assert resp1.status_code == 200
    assert resp1.json() == payload
    assert fetch_calls["count"] == 1

    resp2 = client.get("/v1/calendar", params=params)
    assert resp2.status_code == 200
    assert resp2.json() == payload
    assert fetch_calls["count"] == 1  # served from cache
