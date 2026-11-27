
"""Asignacion segura de incidencias reabiertas en V4."""

from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Usuario
from app.v4_esquema import esquema_v4_disponible
from app.routes.operaciones_ti import asignacion_activa, consultar_ticket, ciclo_actual, observacion_previa
from app.routes.contexto_asignacion import tecnico_asignable


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


class TomaV4Crear(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ciclo_actual: int = Field(gt=1)


class TomaV4Respuesta(AsignacionV4Respuesta):
    origen_asignacion: str = "AUTOTOMA"


class ReasignacionV4Crear(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    nuevo_tecnico_id: UUID
    motivo: str = Field(min_length=5, max_length=500)
    asignacion_actual_id: UUID
    ciclo_actual: int = Field(gt=1)


@router.post("/{incidencia_id}/reasignar", response_model=AsignacionV4Respuesta,
             status_code=status.HTTP_201_CREATED)
def reasignar_incidencia_reabierta(incidencia_id: UUID, datos: ReasignacionV4Crear,
        usuario_actual: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    """Cambia solo el responsable del ciclo vigente; conserva asignaciones y cierres."""
    if usuario_actual.rol != "JEFE":
        raise HTTPException(403, "Solo el Jefe de Sistemas puede reasignar.")
    try:
        if not esquema_v4_disponible(db):
            raise HTTPException(503, "Esquema V4 no habilitado.")
        ticket = consultar_ticket(db, incidencia_id, usuario_actual, bloquear=True)
        db.refresh(usuario_actual)
        if not usuario_actual.habilitado or usuario_actual.rol != "JEFE":
            raise HTTPException(403, "Jefatura sin autorización vigente.")
        ciclo = ciclo_actual(db, incidencia_id, True)
        if ciclo <= 1 or ciclo != datos.ciclo_actual or ticket.estado != "En revisión":
            raise HTTPException(409, "El ciclo cambió o no admite reasignación. Actualiza la incidencia.")
        if not observacion_previa(db, incidencia_id, ciclo):
            raise HTTPException(409, "No existe observación que justifique el ciclo.")
        anterior = db.execute(text("""SELECT id,tecnico_id,ciclo_atencion FROM public.asignaciones
            WHERE incidencia_id=:id AND fecha_fin IS NULL FOR UPDATE"""),
            {"id":incidencia_id}).mappings().one_or_none()
        if (anterior is None or anterior["id"] != datos.asignacion_actual_id
                or anterior["ciclo_atencion"] != ciclo):
            raise HTTPException(409, "El responsable cambió. Actualiza antes de reasignar.")
        if anterior["tecnico_id"] == datos.nuevo_tecnico_id:
            raise HTTPException(409, "El técnico seleccionado ya es responsable.")
        perfil_tecnico = tecnico_asignable(db, datos.nuevo_tecnico_id)
        if perfil_tecnico is None:
            raise HTTPException(422, "Seleccione un asistente o practicante habilitado.")
        tecnico = perfil_tecnico.id
        fecha = datetime.now(timezone.utc)
        db.execute(text("UPDATE public.asignaciones SET fecha_fin=:fecha WHERE id=:anterior"),
                   {"fecha":fecha,"anterior":anterior["id"]})
        nueva = db.execute(text("""INSERT INTO public.asignaciones
            (incidencia_id,tecnico_id,asignado_por_id,origen_asignacion,fecha_asignacion,motivo_reasignacion,ciclo_atencion)
            VALUES (:id,:tecnico,:jefe,'JEFATURA',:fecha,:motivo,:ciclo) RETURNING id"""),
            {"id":incidencia_id,"tecnico":tecnico,"jefe":usuario_actual.id,
             "fecha":fecha,"motivo":datos.motivo,"ciclo":ciclo}).scalar_one()
        db.execute(text("""INSERT INTO public.historial_incidencias
            (incidencia_id,usuario_id,accion,descripcion,ciclo_atencion)
            VALUES (:id,:jefe,'REASIGNACION',:descripcion,:ciclo)"""),
            {"id":incidencia_id,"jefe":usuario_actual.id,"ciclo":ciclo,
             "descripcion":f"Responsable anterior: {anterior['tecnico_id']}. Nuevo responsable: {tecnico}. Motivo: {datos.motivo}"})
        result=AsignacionV4Respuesta(asignacion_id=nueva,incidencia_id=incidencia_id,
            tecnico_id=tecnico,ciclo_atencion=ciclo,estado=ticket.estado)
        db.commit()
        return result
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Conflicto de asignación. Actualiza la incidencia.") from None
    except Exception:
        db.rollback()
        raise


@router.post("/{incidencia_id}/tomar", response_model=TomaV4Respuesta, status_code=status.HTTP_201_CREATED)
def tomar_incidencia_reabierta(incidencia_id: UUID, datos: TomaV4Crear,
        usuario_actual: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    if usuario_actual.rol not in {"JEFE", "ASISTENTE", "PRACTICANTE"}:
        raise HTTPException(403, "Solo personal TI autorizado puede tomar incidencias.")
    try:
        if not esquema_v4_disponible(db):
            raise HTTPException(503, "Esquema V4 no habilitado.")
        ticket = consultar_ticket(db, incidencia_id, usuario_actual, bloquear=True)
        db.refresh(usuario_actual)
        if not usuario_actual.habilitado or usuario_actual.rol not in {"JEFE", "ASISTENTE", "PRACTICANTE"}:
            raise HTTPException(403, "Perfil sin autorización vigente.")
        ciclo = ciclo_actual(db, incidencia_id, True)
        if ciclo <= 1 or ciclo != datos.ciclo_actual:
            raise HTTPException(409, "El ciclo cambió o requiere la toma original. Actualiza la incidencia.")
        if ticket.estado != "En revisión":
            raise HTTPException(409, "Solo puede tomarse un ciclo reabierto en revisión.")
        if not observacion_previa(db, incidencia_id, ciclo):
            raise HTTPException(409, "No existe observación que justifique el ciclo.")
        if asignacion_activa(db, incidencia_id) is not None:
            raise HTTPException(409, "La incidencia ya tiene responsable activo.")
        nueva = db.execute(text("""INSERT INTO public.asignaciones
            (incidencia_id, tecnico_id, asignado_por_id, origen_asignacion, ciclo_atencion)
            VALUES (:id, :actor, :actor, 'AUTOTOMA', :ciclo) RETURNING id"""),
            {"id": incidencia_id, "actor": usuario_actual.id, "ciclo": ciclo}).scalar_one()
        db.execute(text("""INSERT INTO public.historial_incidencias
            (incidencia_id, usuario_id, accion, descripcion, ciclo_atencion)
            VALUES (:id, :actor, 'AUTOTOMA', :descripcion, :ciclo)"""),
            {"id": incidencia_id, "actor": usuario_actual.id, "ciclo": ciclo,
             "descripcion": f"Autotoma autorizada para atención propia del ciclo {ciclo}."})
        salida = TomaV4Respuesta(asignacion_id=nueva, incidencia_id=incidencia_id,
            tecnico_id=usuario_actual.id, ciclo_atencion=ciclo, estado=ticket.estado)
        db.commit()
        return salida
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "La incidencia ya fue tomada o asignada. Actualiza el listado.") from error
    except Exception:
        db.rollback()
        raise


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
