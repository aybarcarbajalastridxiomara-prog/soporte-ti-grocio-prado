"""Paso 110D4: contexto seguro de conformidad y reapertura para REPRESENTANTE.

Solo lectura. Selecciona V3 para una BD V3 y V4 para cualquier ciclo
cuando la migracion V4 esta completa. No hace cambios en la base.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Incidencia, Usuario, Verificacion
from app.v4_esquema import esquema_v4_disponible

router = APIRouter(prefix="/api/incidencias", tags=["Contexto de verificacion"])


class EvaluacionActual(BaseModel):
    id: UUID
    resultado: Literal["Conformidad", "Observación"]
    observaciones: str | None
    fecha_verificacion: datetime


class ContextoVerificacion(BaseModel):
    incidencia_id: UUID
    codigo: str
    estado: str
    esquema_v4: bool
    ciclo_actual: int
    fecha_cierre: datetime | None
    evaluacion_actual: EvaluacionActual | None
    puede_verificar: bool
    ruta_verificacion: str


@router.get(
    "/{incidencia_id}/contexto-verificacion",
    response_model=ContextoVerificacion,
    summary="Consultar si el representante puede verificar un cierre",
)
def consultar_contexto_verificacion(
    incidencia_id: UUID,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if usuario_actual.rol != "REPRESENTANTE":
        raise HTTPException(status_code=403, detail="Solo un representante puede verificar.")

    incidencia = db.get(Incidencia, incidencia_id)
    if incidencia is None or incidencia.area_id != usuario_actual.area_id:
        # No revelar la existencia de tickets de otras areas.
        raise HTTPException(status_code=404, detail="Incidencia no encontrada.")

    v4 = esquema_v4_disponible(db)
    ciclo = 1
    if v4:
        ciclo = db.execute(
            text("SELECT ciclo_actual FROM public.incidencias WHERE id = :id"),
            {"id": incidencia_id},
        ).scalar_one()
        evaluacion = db.execute(
            text("""
                SELECT id, resultado, observaciones, fecha_verificacion
                FROM public.verificaciones
                WHERE incidencia_id = :id AND ciclo_atencion = :ciclo
                ORDER BY fecha_verificacion DESC, id DESC
                LIMIT 1
            """),
            {"id": incidencia_id, "ciclo": ciclo},
        ).mappings().one_or_none()
        ultima = EvaluacionActual(**dict(evaluacion)) if evaluacion else None
    else:
        evaluacion = db.scalar(
            select(Verificacion)
            .where(Verificacion.incidencia_id == incidencia_id)
            .order_by(Verificacion.fecha_verificacion.desc(), Verificacion.id.desc())
            .limit(1)
        )
        ultima = EvaluacionActual.model_validate(
            {
                "id": evaluacion.id,
                "resultado": evaluacion.resultado,
                "observaciones": evaluacion.observaciones,
                "fecha_verificacion": evaluacion.fecha_verificacion,
            }
        ) if evaluacion else None

    # La ruta V3 se bloquea tras la migracion V4, incluso en el ciclo 1.
    prefijo = "/api/v4/incidencias" if v4 else "/api/incidencias"
    ruta = f"{prefijo}/{incidencia_id}/verificaciones"
    return ContextoVerificacion(
        incidencia_id=incidencia_id,
        codigo=incidencia.codigo,
        estado=incidencia.estado,
        esquema_v4=v4,
        ciclo_actual=ciclo,
        fecha_cierre=incidencia.fecha_cierre,
        evaluacion_actual=ultima,
        puede_verificar=(incidencia.estado == "Cerrado" and ultima is None),
        ruta_verificacion=ruta,
    )
