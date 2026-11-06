
from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import (
    HistorialIncidencia,
    Incidencia,
    Usuario,
    Verificacion,
)
from app.schemas import VerificacionCrear


router = APIRouter(
    prefix="/api/incidencias",
    tags=["Conformidad y observaciones"],
)


class VerificacionRespuesta(BaseModel):
    """Respuesta registrada por el area solicitante."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    incidencia_id: UUID
    usuario_id: UUID
    resultado: Literal["Conformidad", "Observación"]
    observaciones: str | None
    fecha_verificacion: datetime


@router.post(
    "/{incidencia_id}/verificaciones",
    response_model=VerificacionRespuesta,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar conformidad u observacion",
)
def registrar_verificacion(
    incidencia_id: UUID,
    datos: VerificacionCrear,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registra la respuesta del area tras el cierre tecnico."""

    # Solo los representantes municipales.
    if usuario_actual.rol != "REPRESENTANTE":
        raise HTTPException(
            status_code=403,
            detail=(
                "Solo un representante municipal puede "
                "registrar conformidad u observaciones."
            ),
        )

    try:
        # Bloquear el ticket durante el registro.
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

        # Proteger los tickets de otras areas.
        if incidencia.area_id != usuario_actual.area_id:
            raise HTTPException(
                status_code=404,
                detail="Incidencia no encontrada.",
            )

        # El area evalua una atencion ya finalizada.
        if incidencia.estado != "Cerrado":
            raise HTTPException(
                status_code=409,
                detail=(
                    "La incidencia debe estar cerrada "
                    "para registrar una verificacion."
                ),
            )

        
        # Evitar evaluaciones repetidas sobre el mismo cierre.
        evaluacion_existente = db.scalar(
            select(Verificacion.id)
            .where(
                Verificacion.incidencia_id == incidencia_id
            )
            .limit(1)
        )

        if evaluacion_existente is not None:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Esta incidencia ya tiene una evaluacion "
                    "registrada. Consulte su historial."
                ),
            )

        nueva = Verificacion(
            incidencia_id=incidencia_id,
            usuario_id=usuario_actual.id,
            resultado=datos.resultado,
            observaciones=datos.observaciones,
        )

        db.add(nueva)
        db.flush()

        # Registrar el resultado en el historial del ticket.
        if datos.resultado == "Observación":
            accion = "OBSERVACION"
            descripcion = (
                "El representante municipal registro "
                "una observacion sobre la atencion. "
                f"Detalle: {datos.observaciones}"
            )
        else:
            accion = "CONFORMIDAD"
            descripcion = (
                "El representante municipal registro "
                "su conformidad con la atencion. "
                f"Comentarios: "
                f"{datos.observaciones or 'Sin comentarios.'}"
            )

        evento = HistorialIncidencia(
            incidencia_id=incidencia_id,
            usuario_id=usuario_actual.id,
            accion=accion,
            descripcion=descripcion,
        )

        db.add(evento)
        db.flush()

        # El resultado NO modifica el cierre del ticket.
        respuesta = VerificacionRespuesta.model_validate(
            nueva
        )

        db.commit()
        return respuesta

    except Exception:
        db.rollback()
        raise



@router.get(
    "/{incidencia_id}/verificaciones",
    response_model=list[VerificacionRespuesta],
    summary="Consultar conformidades y observaciones",
)
def consultar_verificaciones(
    incidencia_id: UUID,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consulta las evaluaciones de una incidencia."""

    roles_validos = {
        "JEFE",
        "ASISTENTE",
        "PRACTICANTE",
        "REPRESENTANTE",
    }

    if usuario_actual.rol not in roles_validos:
        raise HTTPException(
            status_code=403,
            detail="No tiene permiso para consultar evaluaciones.",
        )

    incidencia = db.get(Incidencia, incidencia_id)

    if incidencia is None:
        raise HTTPException(
            status_code=404,
            detail="Incidencia no encontrada.",
        )

    # Los representantes solo consultan su propia area.
    if usuario_actual.rol == "REPRESENTANTE":
        if incidencia.area_id != usuario_actual.area_id:
            raise HTTPException(
                status_code=404,
                detail="Incidencia no encontrada.",
            )

    # Mostrar las evaluaciones mas recientes primero.
    consulta = (
        select(Verificacion)
        .where(
            Verificacion.incidencia_id == incidencia_id
        )
        .order_by(
            Verificacion.fecha_verificacion.desc(),
            Verificacion.id.desc(),
        )
    )

    return db.scalars(consulta).all()

