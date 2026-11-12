"""Intervenciones del ciclo vigente de una incidencia reabierta (V4).

No cambia las rutas V3 ni ejecuta migraciones sobre PostgreSQL.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Usuario
from app.routes.intervenciones import IntervencionCrear
from app.v4_esquema import esquema_v4_disponible


router = APIRouter(
    prefix="/api/v4/incidencias",
    tags=["Intervenciones V4"],
)


class IntervencionV4Respuesta(BaseModel):
    id: UUID
    incidencia_id: UUID
    tecnico_id: UUID
    diagnostico: str
    acciones_realizadas: str
    duracion_minutos: int | None
    solucion_aplicada: str | None
    es_solucion_final: bool
    fecha_registro: datetime
    ciclo_atencion: int


@router.post(
    "/{incidencia_id}/intervenciones",
    response_model=IntervencionV4Respuesta,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar intervencion del ciclo reabierto",
)
def registrar_intervencion_v4(
    incidencia_id: UUID,
    datos: IntervencionCrear,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registra una nueva atencion exclusivamente para el ciclo vigente."""

    if usuario_actual.rol not in {"JEFE", "ASISTENTE", "PRACTICANTE"}:
        raise HTTPException(
            status_code=403,
            detail="No tiene permiso para registrar atenciones.",
        )

    try:
        # En V3 no existen las columnas de ciclos: no tocar datos.
        if not esquema_v4_disponible(db):
            raise HTTPException(
                status_code=503,
                detail="Esquema V4 no habilitado.",
            )

        # Bloquear incidencia antes de leer su asignacion activa.
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
            raise HTTPException(404, detail="Incidencia no encontrada.")

        ciclo = incidencia["ciclo_actual"]

        if ciclo <= 1:
            raise HTTPException(
                status_code=409,
                detail="Utilice la ruta original para atenciones del ciclo 1.",
            )

        if incidencia["estado"] != "En revisión":
            raise HTTPException(
                status_code=409,
                detail="La incidencia debe estar en revisión.",
            )

        # El ciclo reabierto debe tener una observacion del anterior.
        observado = db.execute(
            text("""
                SELECT 1
                FROM public.verificaciones
                WHERE incidencia_id = :id
                  AND ciclo_atencion = :ciclo_anterior
                  AND resultado = 'Observación'
                LIMIT 1
            """),
            {"id": incidencia_id, "ciclo_anterior": ciclo - 1},
        ).scalar_one_or_none()

        if observado is None:
            raise HTTPException(
                status_code=409,
                detail="No existe una observación que justifique el ciclo.",
            )

        asignacion = db.execute(
            text("""
                SELECT tecnico_id, ciclo_atencion
                FROM public.asignaciones
                WHERE incidencia_id = :id
                  AND fecha_fin IS NULL
                FOR UPDATE
            """),
            {"id": incidencia_id},
        ).mappings().one_or_none()

        if asignacion is None:
            raise HTTPException(
                status_code=409,
                detail="Primero debe asignarse un técnico al nuevo ciclo.",
            )

        if asignacion["ciclo_atencion"] != ciclo:
            raise HTTPException(
                status_code=409,
                detail="La asignación activa pertenece a otro ciclo.",
            )

        if asignacion["tecnico_id"] != usuario_actual.id:
            raise HTTPException(
                status_code=403,
                detail="Solo el técnico asignado puede registrar la atención.",
            )

        registro = db.execute(
            text("""
                INSERT INTO public.intervenciones (
                    incidencia_id, tecnico_id, diagnostico,
                    acciones_realizadas, duracion_minutos,
                    solucion_aplicada, es_solucion_final, ciclo_atencion
                ) VALUES (
                    :id, :tecnico, :diagnostico,
                    :acciones, :duracion,
                    :solucion, :final, :ciclo
                )
                RETURNING id, fecha_registro
            """),
            {
                "id": incidencia_id,
                "tecnico": usuario_actual.id,
                "diagnostico": datos.diagnostico,
                "acciones": datos.acciones_realizadas,
                "duracion": datos.duracion_minutos,
                "solucion": datos.solucion_aplicada,
                "final": datos.es_solucion_final,
                "ciclo": ciclo,
            },
        ).mappings().one()

        db.execute(
            text("""
                INSERT INTO public.historial_incidencias (
                    incidencia_id, usuario_id, accion,
                    descripcion, ciclo_atencion
                ) VALUES (
                    :id, :usuario, 'INTERVENCION',
                    :descripcion, :ciclo
                )
            """),
            {
                "id": incidencia_id,
                "usuario": usuario_actual.id,
                "descripcion": (
                    f"Atencion tecnica del ciclo {ciclo}. "
                    f"Diagnostico: {datos.diagnostico}. "
                    f"Acciones: {datos.acciones_realizadas}. "
                    f"Solucion: {datos.solucion_aplicada or 'Pendiente'}."
                ),
                "ciclo": ciclo,
            },
        )

        respuesta = IntervencionV4Respuesta(
            id=registro["id"],
            incidencia_id=incidencia_id,
            tecnico_id=usuario_actual.id,
            diagnostico=datos.diagnostico,
            acciones_realizadas=datos.acciones_realizadas,
            duracion_minutos=datos.duracion_minutos,
            solucion_aplicada=datos.solucion_aplicada,
            es_solucion_final=datos.es_solucion_final,
            fecha_registro=registro["fecha_registro"],
            ciclo_atencion=ciclo,
        )

        db.commit()
        return respuesta

    except Exception:
        db.rollback()
        raise


@router.get(
    "/{incidencia_id}/intervenciones",
    response_model=list[IntervencionV4Respuesta],
    summary="Consultar historial tecnico de todos los ciclos V4",
)
def listar_intervenciones_v4(
    incidencia_id: UUID,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista intervenciones por ciclo conservando las atenciones anteriores."""

    if usuario_actual.rol not in {
        "JEFE", "ASISTENTE", "PRACTICANTE", "REPRESENTANTE"
    }:
        raise HTTPException(403, detail="No tiene permiso para consultar.")

    try:
        if not esquema_v4_disponible(db):
            raise HTTPException(503, detail="Esquema V4 no habilitado.")

        incidencia = db.execute(
            text("""
                SELECT area_id FROM public.incidencias
                WHERE id = :id
            """),
            {"id": incidencia_id},
        ).mappings().one_or_none()

        if incidencia is None or (
            usuario_actual.rol == "REPRESENTANTE"
            and incidencia["area_id"] != usuario_actual.area_id
        ):
            raise HTTPException(404, detail="Incidencia no encontrada.")

        filas = db.execute(
            text("""
                SELECT id, incidencia_id, tecnico_id, diagnostico,
                       acciones_realizadas, duracion_minutos,
                       solucion_aplicada, es_solucion_final,
                       fecha_registro, ciclo_atencion
                FROM public.intervenciones
                WHERE incidencia_id = :id
                ORDER BY ciclo_atencion, fecha_registro, id
            """),
            {"id": incidencia_id},
        ).mappings().all()

        return [IntervencionV4Respuesta(**fila) for fila in filas]

    except Exception:
        db.rollback()
        raise
