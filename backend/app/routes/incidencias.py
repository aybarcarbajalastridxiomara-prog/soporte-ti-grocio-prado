
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Incidencia, Usuario
from app.schemas import EstadoIncidencia


router = APIRouter(
    prefix="/api/incidencias",
    tags=["Incidencias"],
)


class IncidenciaResumen(BaseModel):
    """Datos para el listado de incidencias."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    codigo: str
    area_id: UUID
    asunto: str
    estado: EstadoIncidencia
    prioridad: str | None
    fecha_registro: datetime


@router.get(
    "",
    response_model=list[IncidenciaResumen],
    summary="Listar incidencias autorizadas",
)
def listar_incidencias(
    estado: EstadoIncidencia | None = None,
    limite: int = Query(default=50, ge=1, le=100),
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consulta incidencias según el perfil autorizado."""

    roles_validos = {
        "JEFE",
        "ASISTENTE",
        "PRACTICANTE",
        "REPRESENTANTE",
    }

    if usuario_actual.rol not in roles_validos:
        raise HTTPException(
            status_code=403,
            detail="No tiene permiso para consultar incidencias.",
        )

    consulta = select(Incidencia)

    # Los representantes solo consultan su propia área.
    if usuario_actual.rol == "REPRESENTANTE":
        consulta = consulta.where(
            Incidencia.area_id == usuario_actual.area_id
        )

    # Filtro opcional por estado.
    if estado is not None:
        consulta = consulta.where(
            Incidencia.estado == estado
        )

    consulta = (
        consulta
        .order_by(
            Incidencia.fecha_registro.desc(),
            Incidencia.id.desc(),
        )
        .limit(limite)
    )

    return db.scalars(consulta).all()
