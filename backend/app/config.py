
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
    supabase_service_role_key: str = ""
    supabase_smtp_configurado: bool = False
    administracion_perfiles_habilitada: bool = False
    invitaciones_usuarios_habilitadas: bool | None = None
    brevo_habilitado: bool = False
    brevo_api_key: str = ""
    correo_remitente: str = ""
    adjuntos_habilitados: bool = False
    adjuntos_bucket: str = ""


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
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip(),
        supabase_smtp_configurado=os.getenv("SUPABASE_SMTP_CONFIGURADO", "false").lower() == "true",
        administracion_perfiles_habilitada=os.getenv("ADMINISTRACION_PERFILES_HABILITADA", "false").lower() == "true",
        invitaciones_usuarios_habilitadas=(os.getenv("INVITACIONES_USUARIOS_HABILITADAS", "").lower() == "true"
            if "INVITACIONES_USUARIOS_HABILITADAS" in os.environ else None),
        brevo_habilitado=os.getenv("BREVO_HABILITADO", "false").lower() == "true",
        brevo_api_key=os.getenv("BREVO_API_KEY", "").strip(),
        correo_remitente=os.getenv("CORREO_REMITENTE", "").strip(),
        adjuntos_habilitados=os.getenv("ADJUNTOS_HABILITADOS", "false").lower() == "true",
        adjuntos_bucket=os.getenv("ADJUNTOS_BUCKET", "").strip(),
    )
