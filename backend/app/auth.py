
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


def error_401():
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sesion invalida o no iniciada.",
        headers={"WWW-Authenticate": "Bearer"},
    )


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


def get_identity(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> UUID:
    """Verifica el token antes de consultar la base de datos."""

    if credentials is None:
        raise error_401()

    token = credentials.credentials
    settings = get_settings()

    try:
        signing_key = get_jwks_client().get_signing_key_from_jwt(
            token
        )

        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=settings.jwt_issuer,
            options={
                "require": ["sub", "exp", "iss", "aud"]
            },
        )

        if payload.get("role") != "authenticated":
            raise InvalidTokenError("Rol JWT no autorizado.")

        return UUID(payload["sub"])

    except (InvalidTokenError, ValueError, KeyError):
        raise error_401()

    except PyJWKClientError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible verificar la sesion con Supabase.",
        )


def get_current_user(
    user_id: UUID = Depends(get_identity),
    db: Session = Depends(get_db),
) -> Usuario:
    """Consulta el perfil autorizado en PostgreSQL."""

    usuario = db.get(Usuario, user_id)

    if usuario is None or not usuario.habilitado:
        raise HTTPException(
            status_code=403,
            detail="Usuario sin acceso autorizado.",
        )

    return usuario


def require_roles(*roles_permitidos: str):
    """Restringe operaciones segun el rol almacenado."""

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
