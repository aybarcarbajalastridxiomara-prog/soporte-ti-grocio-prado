
from datetime import date, datetime, time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import (
    Asignacion,
    Incidencia,
    Intervencion,
    Usuario,
)


router = APIRouter(
    prefix="/api/incidencias",
    tags=["Informes tecnicos"],
)


class IntervencionInforme(BaseModel):
    """Intervencion incluida en el borrador."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tecnico_id: UUID
    diagnostico: str
    acciones_realizadas: str
    duracion_minutos: int | None
    solucion_aplicada: str | None
    es_solucion_final: bool
    fecha_registro: datetime


class InformeTecnicoBorrador(BaseModel):
    """Informacion para elaborar un informe tecnico."""

    tipo_documento: str
    incidencia_id: UUID
    codigo_incidencia: str

    area_id: UUID
    reportante_id: UUID

    asunto: str
    descripcion_problema: str

    equipo_sistema_afectado: str | None
    ubicacion: str | None

    fecha_inicio_problema: date | None
    hora_inicio_problema: time | None

    estado: str
    prioridad: str | None
    fecha_registro: datetime
    fecha_cierre: datetime | None

    intervenciones: list[IntervencionInforme]
    duracion_total_registrada_minutos: int


@router.get(
    "/{incidencia_id}/informe-tecnico/borrador",
    response_model=InformeTecnicoBorrador,
    summary="Preparar borrador del informe tecnico",
)
def preparar_informe_tecnico(
    incidencia_id: UUID,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Recopila informacion del ticket y sus atenciones."""

    roles_validos = {
        "JEFE",
        "ASISTENTE",
        "PRACTICANTE",
    }

    if usuario_actual.rol not in roles_validos:
        raise HTTPException(
            status_code=403,
            detail="No tiene permiso para consultar informes.",
        )

    incidencia = db.get(Incidencia, incidencia_id)

    if incidencia is None:
        raise HTTPException(
            status_code=404,
            detail="Incidencia no encontrada.",
        )

    # El jefe puede consultar cualquier ticket.
    # El personal tecnico debe haber sido responsable.
    if usuario_actual.rol in {"ASISTENTE", "PRACTICANTE"}:
        asignacion_id = db.scalar(
            select(Asignacion.id)
            .where(
                Asignacion.incidencia_id == incidencia_id,
                Asignacion.tecnico_id == usuario_actual.id,
            )
            .limit(1)
        )

        if asignacion_id is None:
            raise HTTPException(
                status_code=403,
                detail="No participo en la atencion del ticket.",
            )

    consulta = (
        select(Intervencion)
        .where(
            Intervencion.incidencia_id == incidencia_id
        )
        .order_by(
            Intervencion.fecha_registro.asc(),
            Intervencion.id.asc(),
        )
    )

    intervenciones = db.scalars(consulta).all()

    if not intervenciones:
        raise HTTPException(
            status_code=409,
            detail=(
                "La incidencia no tiene intervenciones "
                "registradas para elaborar el informe."
            ),
        )

    duracion_total = sum(
        intervencion.duracion_minutos or 0
        for intervencion in intervenciones
    )

    return InformeTecnicoBorrador(
        tipo_documento="BORRADOR_INFORME_TECNICO",
        incidencia_id=incidencia.id,
        codigo_incidencia=incidencia.codigo,
        area_id=incidencia.area_id,
        reportante_id=incidencia.reportante_id,
        asunto=incidencia.asunto,
        descripcion_problema=incidencia.descripcion,
        equipo_sistema_afectado=(
            incidencia.equipo_sistema_afectado
        ),
        ubicacion=incidencia.ubicacion,
        fecha_inicio_problema=(
            incidencia.fecha_inicio_problema
        ),
        hora_inicio_problema=(
            incidencia.hora_inicio_problema
        ),
        estado=incidencia.estado,
        prioridad=incidencia.prioridad,
        fecha_registro=incidencia.fecha_registro,
        fecha_cierre=incidencia.fecha_cierre,
        intervenciones=[
            IntervencionInforme.model_validate(item)
            for item in intervenciones
        ],
        duracion_total_registrada_minutos=duracion_total,
    )
