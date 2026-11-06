
from datetime import datetime
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import (
    Incidencia,
    Usuario,
    Verificacion,
)


router = APIRouter(
    prefix="/api/seguimiento",
    tags=["Seguimiento de incidencias"],
)


class IncidenciaObservada(BaseModel):
    """Incidencia con observacion del area solicitante."""

    incidencia_id: UUID
    codigo: str
    asunto: str
    area_id: UUID
    estado: str
    fecha_cierre: datetime

    representante_id: UUID
    fecha_observacion: datetime
    detalle_observacion: str


@router.get(
    "/observadas",
    response_model=list[IncidenciaObservada],
    summary="Listar incidencias observadas para jefatura",
)
def listar_incidencias_observadas(
    limite: int = Query(default=50, ge=1, le=100),
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista tickets cuya ultima evaluacion es observacion."""

    # El listado general es exclusivo de jefatura.
    if usuario_actual.rol != "JEFE":
        raise HTTPException(
            status_code=403,
            detail=(
                "Solo el Jefe de Sistemas puede "
                "consultar este seguimiento."
            ),
        )

    # Identificar la evaluacion mas reciente de cada ticket.
    ultima_evaluacion = (
        select(Verificacion.id)
        .where(
            Verificacion.incidencia_id == Incidencia.id
        )
        .order_by(
            Verificacion.fecha_verificacion.desc(),
            Verificacion.id.desc(),
        )
        .limit(1)
        .correlate(Incidencia)
        .scalar_subquery()
    )

    # Consultar las incidencias observadas.
    consulta = (
        select(
            Incidencia.id.label("incidencia_id"),
            Incidencia.codigo,
            Incidencia.asunto,
            Incidencia.area_id,
            Incidencia.estado,
            Incidencia.fecha_cierre,
            Verificacion.usuario_id.label(
                "representante_id"
            ),
            Verificacion.fecha_verificacion.label(
                "fecha_observacion"
            ),
            Verificacion.observaciones.label(
                "detalle_observacion"
            ),
        )
        .select_from(Incidencia)
        .join(
            Verificacion,
            Verificacion.id == ultima_evaluacion,
        )
        .where(
            Incidencia.estado == "Cerrado",
            Verificacion.resultado == "Observación",
        )
        .order_by(
            Verificacion.fecha_verificacion.desc(),
            Verificacion.id.desc(),
        )
        .limit(limite)
    )

    resultados = db.execute(consulta).mappings().all()

    return [
        IncidenciaObservada.model_validate(dict(fila))
        for fila in resultados
    ]
