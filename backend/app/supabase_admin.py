"""API administrativa de Auth. Credencial privada y errores sin datos sensibles."""
import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import HTTPException

from app.config import get_settings


def invitar_en_supabase(correo: str) -> dict:
    settings = get_settings()
    request = Request(
        f"{settings.supabase_url}/auth/v1/invite",
        data=json.dumps({"email": correo}).encode("utf-8"),
        headers={
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=15) as response:
            return json.load(response)
    except HTTPError as error:
        # Nunca propagar cuerpo, cabeceras, correos ni credenciales del proveedor.
        if error.code == 429:
            raise HTTPException(429, "Supabase limitó el envío. Intenta más tarde.") from None
        raise HTTPException(502, "Supabase no aceptó la invitación. Revisa la cuenta y la configuración de correo.") from None
    except (URLError, TimeoutError, ValueError):
        raise HTTPException(502, "No se pudo confirmar la invitación con Supabase. Consulta el estado antes de reintentar.") from None
