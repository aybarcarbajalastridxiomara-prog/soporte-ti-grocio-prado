
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict

from app.auth import get_current_user
from app.models import Usuario


router = APIRouter(
    prefix="/api",
    tags=["Usuarios"],
)


class MiPerfil(BaseModel):
    """Datos del usuario autenticado."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre_completo: str
    usuario: str
    area_id: UUID
    rol: Literal[
        "JEFE",
        "ASISTENTE",
        "PRACTICANTE",
        "REPRESENTANTE",
    ]
    habilitado: bool


@router.get(
    "/me",
    response_model=MiPerfil,
    summary="Consultar mi perfil",
)
def consultar_mi_perfil(
    usuario_actual: Usuario = Depends(get_current_user),
) -> Usuario:
    """
    Devuelve los datos del usuario autenticado.

    El backend obtiene la identidad mediante
    Supabase Auth y consulta el perfil autorizado
    en PostgreSQL.
    """

    return usuario_actual
