"""Runtime settings for backend app."""

from __future__ import annotations

from pydantic import AnyHttpUrl, BaseSettings


class Settings(BaseSettings):
    JBLANKED_API_KEY: str | None = None
    JBLANKED_BASE_URL: AnyHttpUrl = "https://www.jblanked.com/news/api"
    REDIS_URL: str | None = "redis://localhost:6379/0"
    CALENDAR_CACHE_TTL_S: int = 60
    NEWS_CACHE_TTL_S: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
