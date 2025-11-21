"""Calendar router backed by ForexFactory + Redis cache."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import aioredis
from fastapi import APIRouter, HTTPException, Query

from ..clients.forexfactory import fetch_calendar
from ..core.settings import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1", tags=["calendar"])

_redis_client: Optional[aioredis.Redis] = None
_last_good_cache: Dict[str, List[Dict[str, Any]]] = {}


class CircuitBreaker:
    """Very small circuit breaker to avoid hammering upstream."""

    def __init__(
        self,
        failure_threshold: int = 3,
        reset_timeout_s: int = 30,
    ) -> None:
        self.failure_threshold = failure_threshold
        self.reset_timeout = timedelta(seconds=reset_timeout_s)
        self.failures = 0
        self.open_until: Optional[datetime] = None

    def allow_request(self) -> bool:
        if self.open_until is None:
            return True
        now = datetime.now(timezone.utc)
        if now >= self.open_until:
            self.reset()
            return True
        return False

    def record_success(self) -> None:
        self.reset()

    def record_failure(self) -> None:
        self.failures += 1
        if self.failures >= self.failure_threshold:
            self.open_until = datetime.now(timezone.utc) + self.reset_timeout
            logger.warning(
                "Calendar circuit breaker opened for %ss",
                self.reset_timeout.total_seconds(),
            )

    def reset(self) -> None:
        self.failures = 0
        self.open_until = None


_breaker = CircuitBreaker()


async def _redis() -> Optional[aioredis.Redis]:
    global _redis_client
    if not settings.REDIS_URL:
        return None
    if _redis_client:
        return _redis_client
    try:
        _redis_client = await aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
    except Exception as exc:  # pragma: no cover - network config issues
        logger.warning("Failed to connect to redis: %s", exc)
        _redis_client = None
    return _redis_client


async def _cache_get(key: str) -> Optional[List[Dict[str, Any]]]:
    redis = await _redis()
    if not redis:
        return None
    try:
        cached = await redis.get(key)
    except Exception as exc:  # pragma: no cover - redis intermittent errors
        logger.warning("Redis GET failed: %s", exc)
        return None
    if cached is None:
        return None
    try:
        data = json.loads(cached)
    except json.JSONDecodeError:
        return None
    _last_good_cache[key] = data
    return data


async def _cache_set(key: str, value: List[Dict[str, Any]]) -> None:
    redis = await _redis()
    if not redis:
        return
    try:
        await redis.set(
            key,
            json.dumps(value),
            ex=settings.CALENDAR_CACHE_TTL_S,
        )
    except Exception as exc:  # pragma: no cover - redis intermittent errors
        logger.warning("Redis SET failed: %s", exc)


def _cache_key(
    start: int,
    end: int,
    countries: Optional[str],
    min_impact: Optional[str],
) -> str:
    key_parts = ["ff", str(start), str(end), countries or "", min_impact or ""]
    digest = hashlib.md5("|".join(key_parts).encode()).hexdigest()
    return f"cal:{digest}"


@router.get("/calendar")
async def calendar(
    start: int = Query(..., description="epoch seconds UTC"),
    end: int = Query(..., description="epoch seconds UTC"),
    countries: Optional[str] = Query(
        None,
        description="CSV of country codes, e.g. US,EU,GB",
    ),
    min_impact: Optional[str] = Query(None, regex="^(low|medium|high)$"),
):
    cache_key = _cache_key(start, end, countries, min_impact)

    cached = await _cache_get(cache_key)
    if cached is not None:
        return cached

    if not _breaker.allow_request():
        fallback = _last_good_cache.get(cache_key)
        if fallback is not None:
            return fallback
        raise HTTPException(
            status_code=503,
            detail="Calendar temporarily unavailable",
        )

    try:
        result = await fetch_calendar(
            start,
            end,
            countries.split(",") if countries else None,
            min_impact,
        )
    except Exception as exc:
        _breaker.record_failure()
        logger.warning("Calendar upstream error: %s", exc)
        fallback = _last_good_cache.get(cache_key)
        if fallback is not None:
            return fallback
        raise HTTPException(
            status_code=502,
            detail="Calendar upstream error",
        )

    _breaker.record_success()
    _last_good_cache[cache_key] = result
    await _cache_set(cache_key, result)
    return result
