
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)
from jwt import InvalidTokenError, PyJWKClient
from jwt.exceptions import PyJWKClientError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import Usuario


bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=1)
def get_jwks_client() -> PyJWKClient:
    """Obtiene las claves publicas de Supabase Auth."""

    settings = get_settings()

    if not settings.jwks_url:
        raise HTTPException(
            status_code=503,
            detail="Supabase Auth no esta configurado.",
        )

    return PyJWKClient(
        settings.jwks_url,
        lifespan=600,
        timeout=5,
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Usuario:
    """Valida el token y consulta el perfil del usuario."""

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Debe iniciar sesion.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    settings = get_settings()

    try:
        signing_key = (
            get_jwks_client().get_signing_key_from_jwt(token)
        )

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=settings.jwt_issuer,
            options={"require": ["sub", "exp", "iss", "aud"]},
        )

        if payload.get("role") != "authenticated":
            raise InvalidTokenError("Rol JWT no autorizado.")

        user_id = UUID(payload["sub"])

    except (InvalidTokenError, PyJWKClientError, ValueError, KeyError):
        raise HTTPException(
            status_code=401,
            detail="Sesion invalida o expirada.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    except (OSError, TimeoutError):
        raise HTTPException(
            status_code=503,
            detail="No fue posible verificar la sesion.",
        )

    usuario = db.get(Usuario, user_id)

    if usuario is None or not usuario.habilitado:
        raise HTTPException(
            status_code=403,
            detail="Usuario sin acceso autorizado.",
        )

    return usuario


def require_roles(*roles_permitidos: str):
    """Restringe una operacion a determinados perfiles."""

    def validar_rol(
        usuario: Usuario = Depends(get_current_user),
    ) -> Usuario:

        if usuario.rol not in roles_permitidos:
            raise HTTPException(
                status_code=403,
                detail="No tiene permiso para esta operacion.",
            )

        return usuario

    return validar_rol
