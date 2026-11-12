
"""Asignacion segura de incidencias reabiertas en V4."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Usuario
from app.v4_esquema import esquema_v4_disponible


router = APIRouter(
    prefix="/api/v4/incidencias",
    tags=["Asignaciones V4"],
)


class AsignacionV4Crear(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tecnico_id: UUID


class AsignacionV4Respuesta(BaseModel):
    asignacion_id: UUID
    incidencia_id: UUID
    tecnico_id: UUID
    ciclo_atencion: int
    estado: str


@router.post(
    "/{incidencia_id}/asignar",
    response_model=AsignacionV4Respuesta,
    status_code=status.HTTP_201_CREATED,
)
def asignar_incidencia_reabierta(
    incidencia_id: UUID,
    datos: AsignacionV4Crear,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Asigna un tecnico al ciclo reabierto de una incidencia."""

    if usuario_actual.rol != "JEFE":
        raise HTTPException(
            status_code=403,
            detail="Solo el Jefe de Sistemas puede asignar.",
        )

    try:
        if not esquema_v4_disponible(db):
            raise HTTPException(
                status_code=503,
                detail="Esquema V4 no habilitado.",
            )

        incidencia = db.execute(
            text("""
                SELECT id, estado, ciclo_actual
                FROM public.incidencias
                WHERE id = :id
                FOR UPDATE
            """),
            {"id": incidencia_id},
        ).mappings().one_or_none()

        if incidencia is None:
            raise HTTPException(
                status_code=404,
                detail="Incidencia no encontrada.",
            )

        ciclo = incidencia["ciclo_actual"]

        if ciclo <= 1:
            raise HTTPException(
                status_code=409,
                detail="Utilice la asignacion original para el ciclo 1.",
            )

        if incidencia["estado"] != "En revisión":
            raise HTTPException(
                status_code=409,
                detail="La incidencia no esta en revision.",
            )

        # Confirmar que el ciclo anterior fue observado.
        observacion = db.execute(
            text("""
                SELECT 1
                FROM public.verificaciones
                WHERE incidencia_id = :id
                  AND ciclo_atencion = :anterior
                  AND resultado = 'Observación'
                LIMIT 1
            """),
            {
                "id": incidencia_id,
                "anterior": ciclo - 1,
            },
        ).scalar_one_or_none()

        if observacion is None:
            raise HTTPException(
                status_code=409,
                detail="No existe observacion que justifique el ciclo.",
            )

        tecnico = db.execute(
            text("""
                SELECT id, usuario
                FROM public.usuarios
                WHERE id = :tecnico
                  AND habilitado = TRUE
                  AND rol IN ('ASISTENTE', 'PRACTICANTE')
            """),
            {"tecnico": datos.tecnico_id},
        ).mappings().one_or_none()

        if tecnico is None:
            raise HTTPException(
                status_code=422,
                detail="Seleccione un tecnico habilitado.",
            )

        activa = db.execute(
            text("""
                SELECT 1
                FROM public.asignaciones
                WHERE incidencia_id = :id
                  AND fecha_fin IS NULL
                LIMIT 1
            """),
            {"id": incidencia_id},
        ).scalar_one_or_none()

        if activa is not None:
            raise HTTPException(
                status_code=409,
                detail="La incidencia ya tiene responsable activo.",
            )

        nueva = db.execute(
            text("""
                INSERT INTO public.asignaciones (
                    incidencia_id,
                    tecnico_id,
                    asignado_por_id,
                    origen_asignacion,
                    ciclo_atencion
                ) VALUES (
                    :id,
                    :tecnico,
                    :jefe,
                    'JEFATURA',
                    :ciclo
                )
                RETURNING id
            """),
            {
                "id": incidencia_id,
                "tecnico": datos.tecnico_id,
                "jefe": usuario_actual.id,
                "ciclo": ciclo,
            },
        ).scalar_one()

        db.execute(
            text("""
                INSERT INTO public.historial_incidencias (
                    incidencia_id,
                    usuario_id,
                    accion,
                    descripcion,
                    ciclo_atencion
                ) VALUES (
                    :id,
                    :jefe,
                    'ASIGNACION',
                    :descripcion,
                    :ciclo
                )
            """),
            {
                "id": incidencia_id,
                "jefe": usuario_actual.id,
                "descripcion": (
                    f"Asignacion del ciclo {ciclo} "
                    f"al tecnico {tecnico['usuario']}."
                ),
                "ciclo": ciclo,
            },
        )

        respuesta = AsignacionV4Respuesta(
            asignacion_id=nueva,
            incidencia_id=incidencia_id,
            tecnico_id=datos.tecnico_id,
            ciclo_atencion=ciclo,
            estado=incidencia["estado"],
        )

        db.commit()
        return respuesta

    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Conflicto de asignacion. Actualice el ticket.",
        ) from error

    except Exception:
        db.rollback()
        raise
