"""Alpaca Market Data streaming adapter."""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from typing import Iterable, List

import websockets


class AlpacaBarsClient:
    """Connects to Alpaca's streaming API and publishes ticks into the hub."""

    def __init__(self, hub, symbols: Iterable[str], timeframe: str = "1m") -> None:
        self.hub = hub
        self.timeframe = timeframe
        self.symbols: List[str] = [s.strip().upper() for s in symbols if s.strip()]
        self.endpoint = os.getenv("ALPACA_WS", "wss://stream.data.alpaca.markets/v2/sip")
        self.key = os.getenv("ALPACA_KEY_ID") or ""
        self.secret = os.getenv("ALPACA_SECRET_KEY") or ""

        if not self.symbols:
            raise ValueError("AlpacaBarsClient requires at least one symbol")
        if not self.key or not self.secret:
            raise ValueError("ALPACA_KEY_ID/ALPACA_SECRET_KEY are required")

    async def run(self) -> None:
        backoff = 1
        while True:
            try:
                async with websockets.connect(self.endpoint, ping_interval=20, ping_timeout=20) as ws:
                    await self._authenticate(ws)
                    await self._subscribe(ws)
                    backoff = 1
                    async for raw in ws:
                        await self._handle_message(raw)
            except asyncio.CancelledError:
                raise
            except Exception:
                await asyncio.sleep(min(backoff, 30))
                backoff *= 2

    async def _authenticate(self, ws) -> None:
        await ws.send(json.dumps({"action": "auth", "key": self.key, "secret": self.secret}))
        await ws.recv()  # consume auth response

    async def _subscribe(self, ws) -> None:
        payload = {"action": "subscribe", "bars": self.symbols}
        await ws.send(json.dumps(payload))

    async def _handle_message(self, raw: str) -> None:
        try:
            messages = json.loads(raw)
        except json.JSONDecodeError:
            return

        for msg in messages if isinstance(messages, list) else [messages]:
            if msg.get("T") != "b":
                continue
            try:
                ts = datetime.fromisoformat(msg["t"].replace("Z", "+00:00"))
            except (KeyError, ValueError):
                continue

            tick = {
                "ts": int(ts.astimezone(timezone.utc).timestamp() * 1000),
                "o": msg.get("o"),
                "h": msg.get("h"),
                "l": msg.get("l"),
                "c": msg.get("c"),
                "v": msg.get("v", 0),
            }
            symbol = msg.get("S") or self.symbols[0]
            await self.hub.publish_tick(symbol, self.timeframe, tick)
