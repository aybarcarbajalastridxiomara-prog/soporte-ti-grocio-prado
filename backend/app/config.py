
import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    app_name: str
    environment: str
    supabase_url: str
    database_url: str
    frontend_url: str
    jwt_issuer: str
    jwks_url: str


@lru_cache
def get_settings() -> Settings:
    load_dotenv()

    supabase_url = os.getenv(
        "SUPABASE_URL", ""
    ).strip().rstrip("/")

    return Settings(
        app_name="Soporte TI - Grocio Prado",
        environment=os.getenv(
            "APP_ENV", "development"
        ),
        supabase_url=supabase_url,
        database_url=os.getenv(
            "DATABASE_URL", ""
        ),
        frontend_url=os.getenv(
            "FRONTEND_URL",
            "http://localhost:5173"
        ),
        jwt_issuer=(
            f"{supabase_url}/auth/v1"
            if supabase_url else ""
        ),
        jwks_url=(
            f"{supabase_url}/auth/v1/.well-known/jwks.json"
            if supabase_url else ""
        ),
    )
