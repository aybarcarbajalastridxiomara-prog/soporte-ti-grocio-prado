"""Paso 110D3. Contexto de atencion de solo lectura para personal TI.

No ejecuta migraciones ni escrituras; admite esquema V3 y V4.
La autorizacion de operaciones POST se verifica otra vez en sus propias rutas.
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Asignacion, Incidencia, Intervencion, Usuario
from app.v4_esquema import esquema_v4_disponible

router = APIRouter(prefix="/api/incidencias", tags=["Contexto de atencion"])


class ContextoAtencionRespuesta(BaseModel):
    incidencia_id: UUID
    codigo: str
    estado: str
    esquema_v4: bool
    ciclo_actual: int
    tecnico_responsable_id: UUID | None
    es_responsable: bool
    tiene_solucion_final: bool
    puede_intervenir: bool
    puede_cerrar: bool
    ruta_intervencion: str
    ruta_cierre: str


@router.get("/{incidencia_id}/contexto-atencion", response_model=ContextoAtencionRespuesta)
def consultar_contexto_atencion(
    incidencia_id: UUID,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if usuario_actual.rol not in {"JEFE", "ASISTENTE", "PRACTICANTE"}:
        raise HTTPException(status_code=403, detail="Solo personal TI autorizado.")

    incidencia = db.get(Incidencia, incidencia_id)
    if incidencia is None:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada.")

    v4 = esquema_v4_disponible(db)
    ciclo = 1
    if v4:
        ciclo = db.execute(
            text("SELECT ciclo_actual FROM public.incidencias WHERE id = :id"),
            {"id": incidencia_id},
        ).scalar_one()

    asignacion = db.scalar(
        select(Asignacion).where(
            Asignacion.incidencia_id == incidencia_id,
            Asignacion.fecha_fin.is_(None),
        ).order_by(Asignacion.fecha_asignacion.desc(), Asignacion.id.desc()).limit(1)
    )

    ciclo_asignacion = 1
    if asignacion is not None and v4:
        ciclo_asignacion = db.execute(
            text("SELECT ciclo_atencion FROM public.asignaciones WHERE id = :id"),
            {"id": asignacion.id},
        ).scalar_one()

    es_responsable = bool(
        asignacion is not None
        and asignacion.tecnico_id == usuario_actual.id
        and ciclo_asignacion == ciclo
    )
    puede_intervenir = es_responsable and incidencia.estado == "En revisión"
    solucion_final = False

    if puede_intervenir:
        if v4:
            ultima = db.execute(
                text("""
                    SELECT es_solucion_final, solucion_aplicada
                    FROM public.intervenciones
                    WHERE incidencia_id = :id AND tecnico_id = :tecnico
                      AND ciclo_atencion = :ciclo
                    ORDER BY fecha_registro DESC, id DESC LIMIT 1
                """),
                {"id": incidencia_id, "tecnico": usuario_actual.id, "ciclo": ciclo},
            ).mappings().one_or_none()
            solucion_final = bool(
                ultima and ultima["es_solucion_final"]
                and (ultima["solucion_aplicada"] or "").strip()
            )
        else:
            ultima = db.scalar(
                select(Intervencion).where(
                    Intervencion.incidencia_id == incidencia_id,
                    Intervencion.tecnico_id == usuario_actual.id,
                ).order_by(
                    Intervencion.fecha_registro.desc(), Intervencion.id.desc()
                ).limit(1)
            )
            solucion_final = bool(
                ultima and ultima.es_solucion_final
                and (ultima.solucion_aplicada or "").strip()
            )

    base = (
        f"/api/v4/incidencias/{incidencia_id}"
        if ciclo > 1 else f"/api/incidencias/{incidencia_id}"
    )
    return ContextoAtencionRespuesta(
        incidencia_id=incidencia_id,
        codigo=incidencia.codigo,
        estado=incidencia.estado,
        esquema_v4=v4,
        ciclo_actual=ciclo,
        tecnico_responsable_id=asignacion.tecnico_id if asignacion else None,
        es_responsable=es_responsable,
        tiene_solucion_final=solucion_final,
        puede_intervenir=puede_intervenir,
        puede_cerrar=puede_intervenir and solucion_final,
        ruta_intervencion=f"{base}/intervenciones",
        ruta_cierre=f"{base}/cerrar",
    )
