
"""Ruta V4: verificaciones y reapertura por observacion."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Usuario
from app.schemas import VerificacionCrear
from app.v4_esquema import esquema_v4_disponible
from app.v4_reglas import (
    ReglaV4Invalida,
    decidir_verificacion_v4,
)


router = APIRouter(
    prefix="/api/v4/incidencias",
    tags=["Reapertura V4"],
)


class VerificacionV4Respuesta(BaseModel):
    id: UUID
    incidencia_id: UUID
    usuario_id: UUID
    resultado: Literal["Conformidad", "Observación"]
    observaciones: str | None
    fecha_verificacion: datetime
    ciclo_evaluado: int
    ciclo_actual: int
    estado_actual: Literal["Cerrado", "En revisión"]


@router.post(
    "/{incidencia_id}/verificaciones",
    response_model=VerificacionV4Respuesta,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar verificacion y reapertura V4",
)
def registrar_verificacion_v4(
    incidencia_id: UUID,
    datos: VerificacionCrear,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verifica un cierre y reabre si existe observacion."""

    if usuario_actual.rol != "REPRESENTANTE":
        raise HTTPException(
            status_code=403,
            detail="Solo un representante puede verificar incidencias.",
        )

    try:
        # Nunca usar columnas V4 si la base sigue en V3.
        if not esquema_v4_disponible(db):
            raise HTTPException(
                status_code=503,
                detail="Reapertura V4 no habilitada en esta base de datos.",
            )

        # Bloquear el ticket para evitar evaluaciones simultaneas.
        incidencia = db.execute(
            text("""
                SELECT id, area_id, estado, ciclo_actual
                FROM public.incidencias
                WHERE id = :incidencia_id
                FOR UPDATE
            """),
            {"incidencia_id": incidencia_id},
        ).mappings().one_or_none()

        if (
            incidencia is None
            or incidencia["area_id"] != usuario_actual.area_id
        ):
            raise HTTPException(
                status_code=404,
                detail="Incidencia no encontrada.",
            )

        ciclo = incidencia["ciclo_actual"]

        try:
            decision = decidir_verificacion_v4(
                estado_actual=incidencia["estado"],
                ciclo_actual=ciclo,
                resultado=datos.resultado,
                observaciones=datos.observaciones,
            )
        except ReglaV4Invalida as error:
            raise HTTPException(
                status_code=409,
                detail=str(error),
            ) from error

        # Se permite una sola verificacion por ciclo.
        duplicado = db.execute(
            text("""
                SELECT 1
                FROM public.verificaciones
                WHERE incidencia_id = :incidencia_id
                  AND ciclo_atencion = :ciclo
                LIMIT 1
            """),
            {
                "incidencia_id": incidencia_id,
                "ciclo": ciclo,
            },
        ).scalar_one_or_none()

        if duplicado is not None:
            raise HTTPException(
                status_code=409,
                detail="Este ciclo ya tiene una verificacion registrada.",
            )

        # Registrar la evaluacion del ciclo que acaba de cerrarse.
        registro = db.execute(
            text("""
                INSERT INTO public.verificaciones (
                    incidencia_id, usuario_id, resultado,
                    observaciones, ciclo_atencion
                ) VALUES (
                    :incidencia_id, :usuario_id, :resultado,
                    :observaciones, :ciclo
                )
                RETURNING id, fecha_verificacion
            """),
            {
                "incidencia_id": incidencia_id,
                "usuario_id": usuario_actual.id,
                "resultado": datos.resultado,
                "observaciones": datos.observaciones,
                "ciclo": ciclo,
            },
        ).mappings().one()

        accion = (
            "OBSERVACION"
            if datos.resultado == "Observación"
            else "CONFORMIDAD"
        )

        detalle = datos.observaciones or "Sin comentarios."

        db.execute(
            text("""
                INSERT INTO public.historial_incidencias (
                    incidencia_id, usuario_id, accion,
                    descripcion, ciclo_atencion
                ) VALUES (
                    :incidencia_id, :usuario_id, :accion,
                    :descripcion, :ciclo
                )
            """),
            {
                "incidencia_id": incidencia_id,
                "usuario_id": usuario_actual.id,
                "accion": accion,
                "descripcion": f"Verificacion del ciclo {ciclo}: {detalle}",
                "ciclo": ciclo,
            },
        )

        # Una observacion abre otro ciclo conservando el ticket.
        if decision.limpiar_cierre_vigente:
            db.execute(
                text("""
                    UPDATE public.incidencias
                    SET estado = 'En revisión',
                        ciclo_actual = :ciclo_nuevo,
                        fecha_cierre = NULL,
                        cerrado_por_usuario_id = NULL
                    WHERE id = :incidencia_id
                """),
                {
                    "incidencia_id": incidencia_id,
                    "ciclo_nuevo": decision.ciclo_siguiente,
                },
            )

            db.execute(
                text("""
                    INSERT INTO public.historial_incidencias (
                        incidencia_id, usuario_id, accion,
                        descripcion, ciclo_atencion
                    ) VALUES (
                        :incidencia_id, :usuario_id, 'REAPERTURA',
                        :descripcion, :ciclo
                    )
                """),
                {
                    "incidencia_id": incidencia_id,
                    "usuario_id": usuario_actual.id,
                    "descripcion": (
                        f"Reapertura por observacion del ciclo {ciclo}. "
                        "Pendiente de nueva asignacion tecnica."
                    ),
                    "ciclo": decision.ciclo_siguiente,
                },
            )

        respuesta = VerificacionV4Respuesta(
            id=registro["id"],
            incidencia_id=incidencia_id,
            usuario_id=usuario_actual.id,
            resultado=datos.resultado,
            observaciones=datos.observaciones,
            fecha_verificacion=registro["fecha_verificacion"],
            ciclo_evaluado=ciclo,
            ciclo_actual=decision.ciclo_siguiente,
            estado_actual=decision.estado_siguiente,
        )

        db.commit()
        return respuesta

    except IntegrityError as error:
        db.rollback()

        diagnostico = getattr(error.orig, "diag", None)

        if getattr(diagnostico, "constraint_name", None) == (
            "ux_verificaciones_incidencia_ciclo"
        ):
            raise HTTPException(
                status_code=409,
                detail="Este ciclo ya tiene una verificacion registrada.",
            ) from error

        raise

    except Exception:
        db.rollback()
        raise
