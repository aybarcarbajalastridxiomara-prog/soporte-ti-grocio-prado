"""API administrativa de Auth. Credencial privada y errores sin datos sensibles."""
import json
from uuid import UUID

from fastapi import HTTPException

from app.config import get_settings
from app.servicios_privados import origen_supabase, peticion_privada, cabeceras_supabase


def consultar_correo_supabase(identidad: UUID) -> str | None:
    settings = get_settings()
    if not settings.supabase_service_role_key:
        raise HTTPException(503, "La consulta de correo requiere la credencial privada de Auth en el servidor.")
    code, body = peticion_privada(
        f"{origen_supabase(settings.supabase_url)}/auth/v1/admin/users/{identidad}",
        headers=cabeceras_supabase(settings.supabase_service_role_key),
    )
    if code == 404:
        raise HTTPException(404, "El perfil no tiene una cuenta vinculada en Supabase Auth.")
    if code == 429:
        raise HTTPException(429, "Supabase limitó la consulta. Intenta nuevamente más tarde.")
    if code != 200:
        raise HTTPException(502, "No se pudo consultar el correo en Supabase Auth.")
    try:
        datos = json.loads(body)
        if UUID(datos["id"]) != identidad:
            raise ValueError
        correo = datos.get("email")
        return correo if isinstance(correo, str) and correo.strip() else None
    except (KeyError, TypeError, ValueError, AttributeError):
        raise HTTPException(502, "Supabase Auth no devolvió la identidad esperada.") from None


def enviar_correo_auth(ruta: str, correo: str) -> bytes:
    settings = get_settings()
    if not settings.supabase_service_role_key:
        raise HTTPException(503, "Falta la credencial privada de administración de Auth.")
    code, body = peticion_privada(
        f"{origen_supabase(settings.supabase_url)}/auth/v1/{ruta}",
        data=json.dumps({"email": correo}).encode("utf-8"),
        headers={
            **cabeceras_supabase(settings.supabase_service_role_key),
            "Content-Type": "application/json",
        },
        method="POST",
    )
    if code == 429:
        raise HTTPException(429, "Supabase limitó el envío. Intenta más tarde.")
    if ruta == "invite" and code == 422:
        raise HTTPException(409, "Supabase no aceptó una nueva invitación para ese correo.")
    if code not in (200, 201, 204):
        raise HTTPException(502, "Supabase no aceptó el envío. Actualiza el directorio y comprueba la configuración de correo.")
    return body


def invitar_en_supabase(correo: str) -> dict:
    body = enviar_correo_auth("invite", correo)
    try:
        usuario = json.loads(body)
        if not isinstance(usuario, dict):
            raise ValueError
        return usuario
    except ValueError:
        raise HTTPException(502, "No se pudo confirmar la invitación con Supabase. Consulta el estado antes de reintentar.") from None


def recuperar_en_supabase(correo: str) -> None:
    enviar_correo_auth("recover", correo)
