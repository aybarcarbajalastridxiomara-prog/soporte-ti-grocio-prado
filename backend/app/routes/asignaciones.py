
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import (
    Asignacion,
    HistorialIncidencia,
    Incidencia,
    Usuario,
)


router = APIRouter(
    prefix="/api/asignaciones",
    tags=["Asignaciones"],
)


class AsignacionRespuesta(BaseModel):
    asignacion_id: UUID
    incidencia_id: UUID
    tecnico_id: UUID
    origen_asignacion: str
    estado: str


@router.post(
    "/{incidencia_id}/tomar",
    response_model=AsignacionRespuesta,
    status_code=status.HTTP_201_CREATED,
    summary="Tomar una incidencia sin asignar",
)
def tomar_incidencia(
    incidencia_id: UUID,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permite al personal autorizado tomar una incidencia."""

    # Solamente asistentes y practicantes.
    if usuario_actual.rol not in {
        "ASISTENTE",
        "PRACTICANTE",
    }:
        raise HTTPException(
            status_code=403,
            detail="No tiene permiso para tomar incidencias.",
        )

    try:
        # Bloquear el ticket durante la operacion.
        incidencia = db.scalar(
            select(Incidencia)
            .where(Incidencia.id == incidencia_id)
            .with_for_update()
        )

        if incidencia is None:
            raise HTTPException(
                status_code=404,
                detail="Incidencia no encontrada.",
            )

        if incidencia.estado == "Cerrado":
            raise HTTPException(
                status_code=409,
                detail="No se puede tomar una incidencia cerrada.",
            )

        # Verificar si ya existe un responsable activo.
        asignacion_actual = db.scalar(
            select(Asignacion).where(
                Asignacion.incidencia_id == incidencia_id,
                Asignacion.fecha_fin.is_(None),
            )
        )

        if asignacion_actual is not None:
            raise HTTPException(
                status_code=409,
                detail="La incidencia ya tiene un responsable.",
            )

        nueva = Asignacion(
            incidencia_id=incidencia_id,
            tecnico_id=usuario_actual.id,
            asignado_por_id=usuario_actual.id,
            origen_asignacion="AUTOTOMA",
        )

        db.add(nueva)

        # La incidencia pasa a estar en revision.
        incidencia.estado = "En revisión"

        db.flush()

        evento = HistorialIncidencia(
            incidencia_id=incidencia_id,
            usuario_id=usuario_actual.id,
            accion="AUTOTOMA",
            descripcion=(
                "El integrante de Sistemas "
                "tomo la incidencia para su atencion."
            ),
        )

        db.add(evento)
        db.flush()

        respuesta = AsignacionRespuesta(
            asignacion_id=nueva.id,
            incidencia_id=incidencia_id,
            tecnico_id=usuario_actual.id,
            origen_asignacion="AUTOTOMA",
            estado="En revisión",
        )

        db.commit()

        return respuesta

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=(
                "La incidencia ya fue asignada. "
                "Actualice el listado."
            ),
        )

    except Exception:
        db.rollback()
        raise
