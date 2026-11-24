"""API administrativa de Auth. Credencial privada y errores sin datos sensibles."""
import json

from fastapi import HTTPException

from app.config import get_settings
from app.servicios_privados import origen_supabase, peticion_privada, cabeceras_supabase


def invitar_en_supabase(correo: str) -> dict:
    settings = get_settings()
    if not settings.supabase_service_role_key:
        raise HTTPException(503, "Falta la credencial privada de administración de Auth.")
    code, body = peticion_privada(
        f"{origen_supabase(settings.supabase_url)}/auth/v1/invite",
        data=json.dumps({"email": correo}).encode("utf-8"),
        headers={
            **cabeceras_supabase(settings.supabase_service_role_key),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    if code == 429:
        raise HTTPException(429, "Supabase limitó el envío. Intenta más tarde.")
    if code not in (200, 201):
        raise HTTPException(502, "Supabase no aceptó la invitación. Revisa la cuenta y la configuración de correo.")
    try:
        return json.loads(body)
    except ValueError:
        raise HTTPException(502, "No se pudo confirmar la invitación con Supabase. Consulta el estado antes de reintentar.") from None
