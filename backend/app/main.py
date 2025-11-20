import asyncio
import json
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Set, Tuple

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from zoneinfo import ZoneInfo

from .config import OHLC_DB_URL  # noqa: F401 (import ensures env validation)
from .providers.alpaca_ws import AlpacaBarsClient

NY = ZoneInfo("America/New_York")

TF_STEP_SEC = {
    "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400
}

def nyse_open_close(dt_utc: datetime) -> Tuple[datetime, datetime]:
    # Returns today's regular session in UTC for a given utc time
    et = dt_utc.astimezone(NY)
    d = et.date()
    open_et = datetime(d.year, d.month, d.day, 9, 30, tzinfo=NY)
    close_et = datetime(d.year, d.month, d.day, 16, 0, tzinfo=NY)
    return open_et.astimezone(timezone.utc), close_et.astimezone(timezone.utc)

def align_bucket_start(ts_utc: datetime, tf: str) -> datetime:
    # Align to NYSE session anchor (09:30 ET) for intraday; 1d to ET midnight
    step = TF_STEP_SEC[tf]
    if tf == "1d":
        et_midnight = ts_utc.astimezone(NY).replace(hour=0, minute=0, second=0, microsecond=0)
        epoch = et_midnight.astimezone(timezone.utc)
    else:
        open_utc, _ = nyse_open_close(ts_utc)
        # number of seconds since today's open (if before open, use previous business day open)
        if ts_utc < open_utc:
            prev = ts_utc - timedelta(days=1)
            open_utc, _ = nyse_open_close(prev)
        delta = int((ts_utc - open_utc).total_seconds())
        buckets = max(0, delta // step)
        epoch = open_utc + timedelta(seconds=buckets * step)
    return epoch

# --- Subscription manager ---
class Hub:
    def __init__(self):
        self.clients: Dict[WebSocket, str] = {}
        self.subs: Dict[Tuple[str, str], Set[WebSocket]] = {}  # (symbol, tf) -> sockets
        self.session_id = str(uuid.uuid4())

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients[ws] = self.session_id
        await ws.send_json({"type": "hello", "sessionId": self.session_id})

    def disconnect(self, ws: WebSocket):
        self.clients.pop(ws, None)
        for key in list(self.subs.keys()):
            self.subs[key].discard(ws)
            if not self.subs[key]:
                self.subs.pop(key, None)

    def subscribe(self, ws: WebSocket, symbol: str, tf: str):
        key = (symbol, tf)
        self.subs.setdefault(key, set()).add(ws)

    def unsubscribe(self, ws: WebSocket, _id: str):
        # client holds its id; here we keep it simple and remove ws from all sets
        for key in list(self.subs.keys()):
            self.subs[key].discard(ws)
            if not self.subs[key]:
                self.subs.pop(key, None)

    async def publish_tick(self, symbol: str, tf: str, tick: dict):
        # tick = { "ts": epoch_ms, "o","h","l","c","v" } (raw or partial)
        ts = datetime.fromtimestamp(tick["ts"]/1000, tz=timezone.utc)
        tstart = align_bucket_start(ts, tf)
        # we consider barClose when tick ts exceeds bucket start + step
        step = TF_STEP_SEC[tf]
        next_start = tstart + timedelta(seconds=step)
        bar_close = ts >= next_start

        payload = {
            "type": "bar",
            "sessionId": self.session_id,
            "symbol": symbol,
            "tf": tf,
            "tsStart": int(tstart.timestamp() * 1000),
            "o": float(tick["o"]),
            "h": float(tick["h"]),
            "l": float(tick["l"]),
            "c": float(tick["c"]),
            "v": int(tick.get("v", 0)),
            "barClose": bool(bar_close),
        }
        sockets = self.subs.get((symbol, tf), set())
        for ws in list(sockets):
            try:
                await ws.send_text(json.dumps(payload))
            except WebSocketDisconnect:
                self.disconnect(ws)

hub = Hub()
app = FastAPI()

@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await hub.connect(ws)
    try:
        while True:
            msg = await ws.receive_text()
            data = json.loads(msg)
            t = data.get("type")
            if t == "subscribe":
                hub.subscribe(ws, data["symbol"], data["tf"])
            elif t == "unsubscribe":
                hub.unsubscribe(ws, data.get("id", ""))
    except WebSocketDisconnect:
        hub.disconnect(ws)

# --- Demo publisher (replace with your market stream) ---
async def demo_feed():
    import random
    symbol, tf = "AAPL", "1m"
    c = 270.0
    while True:
        now_ms = int(datetime.now(tz=timezone.utc).timestamp()*1000)
        o = c
        h = c + random.uniform(0, 0.4)
        l = c - random.uniform(0, 0.4)
        c = l + (h-l)*random.random()
        v = random.randint(100, 5000)
        await hub.publish_tick(symbol, tf, {"ts": now_ms, "o": o, "h": h, "l": l, "c": c, "v": v})
        await asyncio.sleep(1.0)

@app.on_event("startup")
async def start_demo():
    if os.getenv("ENABLE_DEMO_FEED", "false").lower() in {"1", "true", "yes"}:
        asyncio.create_task(demo_feed())

    alpaca_key = os.getenv("ALPACA_KEY_ID")
    alpaca_secret = os.getenv("ALPACA_SECRET_KEY")
    if alpaca_key and alpaca_secret:
        symbols = os.getenv("LIVE_SYMBOLS", "AAPL").split(",")
        timeframe = os.getenv("LIVE_TF", "1m")
        client = AlpacaBarsClient(hub, symbols, timeframe=timeframe)
        asyncio.create_task(client.run())

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
