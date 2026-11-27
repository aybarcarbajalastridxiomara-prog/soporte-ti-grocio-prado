"""Cierre tecnico del ciclo vigente en incidencias reabiertas (V4).

Ruta independiente. No ejecuta migraciones ni modifica las rutas V3.
La proteccion de rutas V3 frente a ciclos > 1 se abordara antes del despliegue.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Usuario
from app.routes.incidencias import CierreCrear
from app.v4_esquema import esquema_v4_disponible
from app.v4_reglas import existe_solucion_final_del_ciclo


router = APIRouter(prefix="/api/v4/incidencias", tags=["Cierre V4"])


class CierreV4Respuesta(BaseModel):
    incidencia_id: UUID
    codigo: str
    estado: Literal["Cerrado"]
    cerrado_por_usuario_id: UUID
    fecha_cierre: datetime
    ciclo_atencion: int
    intervencion_final_id: UUID


@router.post(
    "/{incidencia_id}/cerrar",
    response_model=CierreV4Respuesta,
    summary="Cerrar una incidencia reabierta con solucion del ciclo vigente",
)
def cerrar_incidencia_v4(
    incidencia_id: UUID,
    datos: CierreCrear,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if usuario_actual.rol not in {"JEFE", "ASISTENTE", "PRACTICANTE"}:
        raise HTTPException(status_code=403, detail="No puede cerrar incidencias.")

    try:
        if not esquema_v4_disponible(db):
            raise HTTPException(
                status_code=503,
                detail="El cierre V4 no esta habilitado en esta base.",
            )

        # Serializar el cierre con asignaciones, intervenciones y reaperturas.
        incidencia = db.execute(
            text("""
                SELECT id, codigo, estado, ciclo_actual
                FROM public.incidencias
                WHERE id = :id
                FOR UPDATE
            """),
            {"id": incidencia_id},
        ).mappings().one_or_none()

        if incidencia is None:
            raise HTTPException(status_code=404, detail="Incidencia no encontrada.")

        ciclo = incidencia["ciclo_actual"]
        if ciclo <= 1:
            raise HTTPException(
                status_code=409,
                detail="El ciclo 1 se cierra por la ruta original V3.",
            )

        if incidencia["estado"] != "En revisión":
            raise HTTPException(
                status_code=409,
                detail="Solo se cierra una incidencia en revision.",
            )

        observada = db.execute(
            text("""
                SELECT 1 FROM public.verificaciones
                WHERE incidencia_id = :id
                  AND ciclo_atencion = :anterior
                  AND resultado = 'Observación'
                LIMIT 1
            """),
            {"id": incidencia_id, "anterior": ciclo - 1},
        ).scalar_one_or_none()
        if observada is None:
            raise HTTPException(
                status_code=409,
                detail="El ciclo vigente no tiene reapertura justificada.",
            )

        asignacion = db.execute(
            text("""
                SELECT id, tecnico_id, ciclo_atencion
                FROM public.asignaciones
                WHERE incidencia_id = :id AND fecha_fin IS NULL
                FOR UPDATE
            """),
            {"id": incidencia_id},
        ).mappings().one_or_none()
        if asignacion is None:
            raise HTTPException(
                status_code=409,
                detail="La incidencia no tiene un tecnico asignado.",
            )
        if asignacion["ciclo_atencion"] != ciclo:
            raise HTTPException(
                status_code=409,
                detail="La asignacion activa es de un ciclo anterior.",
            )
        if asignacion["tecnico_id"] != usuario_actual.id:
            raise HTTPException(
                status_code=403,
                detail="Solo el tecnico responsable puede cerrar.",
            )

        # Importante: solo la ultima intervencion DEL CICLO ACTUAL.
        # Nunca considerar una solucion del ciclo 1 para cerrar el ciclo 2.
        ultima = db.execute(
            text("""
                SELECT id, ciclo_atencion, es_solucion_final, solucion_aplicada
                FROM public.intervenciones
                WHERE incidencia_id = :id
                  AND tecnico_id = :tecnico
                  AND ciclo_atencion = :ciclo
                ORDER BY fecha_registro DESC, id DESC
                LIMIT 1
            """),
            {"id": incidencia_id, "tecnico": usuario_actual.id, "ciclo": ciclo},
        ).mappings().one_or_none()
        if ultima is None or not existe_solucion_final_del_ciclo(
            ciclo_actual=ciclo,
            ciclo_intervencion=ultima["ciclo_atencion"],
            es_solucion_final=ultima["es_solucion_final"],
            solucion_aplicada=ultima["solucion_aplicada"],
        ):
            raise HTTPException(
                status_code=409,
                detail="Registre una solucion final valida del ciclo actual.",
            )

        # Todos los cambios y el historial se confirman en una transaccion.
        fecha_cierre = db.execute(
            text("""
                UPDATE public.incidencias
                SET estado = 'Cerrado',
                    fecha_cierre = now(),
                    cerrado_por_usuario_id = :tecnico
                WHERE id = :id
                RETURNING fecha_cierre
            """),
            {"id": incidencia_id, "tecnico": usuario_actual.id},
        ).scalar_one()
        db.execute(
            text("""
                UPDATE public.asignaciones
                SET fecha_fin = :fecha
                WHERE id = :asignacion_id
                  AND fecha_fin IS NULL
                  AND ciclo_atencion = :ciclo
            """),
            {
                "fecha": fecha_cierre,
                "asignacion_id": asignacion["id"],
                "ciclo": ciclo,
            },
        )
        db.execute(
            text("""
                INSERT INTO public.historial_incidencias (
                    incidencia_id, usuario_id, accion, descripcion,
                    ciclo_atencion
                ) VALUES (
                    :id, :usuario, 'CIERRE', :descripcion, :ciclo
                )
            """),
            {
                "id": incidencia_id,
                "usuario": usuario_actual.id,
                "descripcion": (
                    f"Cierre tecnico del ciclo {ciclo}. "
                    f"Resumen: {datos.resumen_cierre}. "
                    f"Solucion: {ultima['solucion_aplicada']}"
                ),
                "ciclo": ciclo,
            },
        )

        respuesta = CierreV4Respuesta(
            incidencia_id=incidencia_id,
            codigo=incidencia["codigo"],
            estado="Cerrado",
            cerrado_por_usuario_id=usuario_actual.id,
            fecha_cierre=fecha_cierre,
            ciclo_atencion=ciclo,
            intervencion_final_id=ultima["id"],
        )
        db.commit()
        return respuesta

    except Exception:
        db.rollback()
        raise
