"""Runtime configuration (environment variables, prefix JADHR_)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="JADHR_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://jadhr:jadhr@localhost:5442/jadhr"
    cors_origins: list[str] = ["http://localhost:3210"]
    public_base_url: str = "http://localhost:8000"
    rate_limit_per_minute: int = 600
    # the public API (P10.2b, 08 §8.1): an address without a key, and each key, per minute
    public_rate_per_minute: int = 120
    key_rate_per_minute: int = 600
    # Shared with the web server: its server-side renders send it and are not rate-limited per IP,
    # since every render comes from the one web host. Unset → no request is exempt.
    internal_token: str | None = None
    environment: str = "development"
    # After a release loads, the loader asks the web app to expire its cached pages (apps/web
    # src/app/api/revalidate). Unset → the step is skipped and the loader says so.
    web_revalidate_url: str | None = None
    revalidate_secret: str | None = None
    # OpenSearch (derived index; Postgres is the source of truth). Unset → search falls back to Postgres.
    search_url: str | None = "http://localhost:9201"
    search_timeout: float = 3.0

    # ─── Releases (P10.1b) ──────────────────────────────────────────────────────
    # where built releases live (data/release/<version>/MANIFEST.json and its files); a relative path is from the repo
    release_dir: str = "data/release"

    # ─── Accounts and sync (P6, D3) ────────────────────────────────────────────
    # where the web app lives, for the links in sign-in e-mails
    public_web_url: str = "http://localhost:3210"
    # "dev" keeps messages in memory and lets a development server read them back (never in production);
    # "smtp" sends them; "none" sends nothing (accounts by e-mail are then off)
    mail_backend: str = "dev"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    mail_from: str = "Jadhr <no-reply@localhost>"
    # 32 bytes, base64: encrypts synced records at rest. Required in production; development derives one.
    data_key: str | None = None
    session_days: int = 90
    login_token_minutes: int = 15
    history_days: int = 30
    # a deletion's tombstone travels to every device; after this it goes, and a device behind it resyncs in full
    tombstone_days: int = 90
    # requests one account may make in a minute, and sign-in mails one address may ask for in an hour
    account_rate_per_minute: int = 600
    mail_per_ip_per_hour: int = 20
    lookup_retention_days: int = 365
    # sign-in with Google and Apple appears only when these are set (no button that only pretends)
    google_client_id: str | None = None
    google_client_secret: str | None = None
    apple_client_id: str | None = None
    apple_team_id: str | None = None
    apple_key_id: str | None = None
    apple_private_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
