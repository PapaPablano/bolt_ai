"""Application configuration helpers."""

from __future__ import annotations

import os

OHLC_DB_URL = os.getenv("OHLC_DB_URL")
APP_DB_URL = os.getenv("DATABASE_URL")

if not OHLC_DB_URL:
  raise RuntimeError("OHLC_DB_URL is required for Timescale queries")
