"""API administrativa de Auth. Credencial privada y errores sin datos sensibles."""
import json
from uuid import UUID
from urllib.parse import urlencode, urlsplit

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
    if ruta not in {"invite", "recover"}:
        raise HTTPException(503, "Operación de correo no autorizada.")
    retorno = retorno_auth_verificado()
    code, body = peticion_privada(
        f"{origen_supabase(settings.supabase_url)}/auth/v1/{ruta}?{urlencode({'redirect_to': retorno})}",
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


def retorno_auth_verificado(settings=None) -> str:
    """Único retorno configurado por el operador; nunca proviene del formulario."""
    settings = settings or get_settings()
    try:
        destino = urlsplit(settings.frontend_url)
        local = settings.environment in {"ci", "test", "qa"} and destino.hostname in {"127.0.0.1", "localhost"}
        if (destino.scheme != "https" and not (local and destino.scheme == "http")) or not destino.hostname or destino.username or destino.password or destino.query or destino.fragment:
            raise ValueError
        if destino.path not in {"", "/"} or (not local and destino.port not in {None, 443}):
            raise ValueError
    except ValueError:
        raise HTTPException(503, "El operador debe verificar la URL HTTPS de retorno de Auth.") from None
    return settings.frontend_url.rstrip("/") + "/"


def identidad_pendiente(correo: str, solicitud: UUID, huella: str, *, datos_correo: dict[str, str] | None = None) -> UUID:
    """Crea sin contraseña, confirmación ni correo. Reintenta solo SU propia operación.

    El marcador está en app_metadata (solo Admin), no en user_metadata editable.
    Nunca adopta ni modifica identidades que existieran antes de esta solicitud.
    """
    settings = get_settings()
    origen = origen_supabase(settings.supabase_url)
    headers = {**cabeceras_supabase(settings.supabase_service_role_key), "Content-Type": "application/json"}
    marca = {"solicitud": str(solicitud), "huella": huella}
    datos_alta = {"email": correo, "email_confirm": False, "app_metadata": {"alta_municipal": marca}}
    if datos_correo:
        datos_alta["user_metadata"] = datos_correo
    code, body = peticion_privada(f"{origen}/auth/v1/admin/users", method="POST", headers=headers,
        data=json.dumps(datos_alta).encode())

    def comprobar(datos):
        try:
            identidad = UUID(datos["id"])
            if (datos.get("email", "").casefold() != correo.casefold()
                    or datos.get("email_confirmed_at")
                    or datos.get("app_metadata", {}).get("alta_municipal") != marca):
                raise ValueError
            return identidad
        except (ValueError, KeyError, TypeError, AttributeError):
            raise HTTPException(409, "La identidad no pertenece a esta solicitud de alta. No se cambió ninguna cuenta existente.") from None

    if code in {200, 201}:
        try:
            return comprobar(json.loads(body))
        except ValueError:
            raise HTTPException(502, "Auth no confirmó la creación. Reintenta la misma solicitud; no cambies sus datos.") from None
    if code == 429:
        raise HTTPException(429, "Auth limitó la creación. Reintenta más tarde la misma solicitud.")
    if code not in {409, 422}:
        raise HTTPException(502, "No se pudo confirmar el alta en Auth. Reintenta la misma solicitud.")
    # Una respuesta perdida puede haber creado la identidad. Solo recuperamos la
    # que coincide con ambos marcadores privados; no reenviamos correos aquí.
    for pagina in range(1, 101):
        estado, raw = peticion_privada(f"{origen}/auth/v1/admin/users?page={pagina}&per_page=100", headers=headers)
        if estado != 200:
            raise HTTPException(503, "No se pudo conciliar el alta. El operador debe comprobar su estado.")
        try:
            usuarios = json.loads(raw)["users"]
            if not isinstance(usuarios, list):
                raise ValueError
            for cuenta in usuarios:
                if cuenta.get("email", "").casefold() == correo.casefold():
                    return comprobar(cuenta)
        except (ValueError, KeyError, TypeError, AttributeError):
            raise HTTPException(502, "Auth no devolvió un directorio válido.") from None
        if len(usuarios) < 100:
            break
    raise HTTPException(409, "El correo ya existe o requiere conciliación del operador. No se envió invitación.")
