"""Capacidades de toma y prioridad. La reapertura no se modifica aquí."""
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.lecturas_incidencias import exigir_lectura_tecnica
from app.db import get_db
from app.models import Asignacion, HistorialIncidencia, Incidencia, Usuario
from app.prioridades import DatosPrioridad, Prioridad, sugerir_prioridad, ultimos_eventos
from app.v4_esquema import esquema_v4_disponible

router = APIRouter(prefix="/api/incidencias", tags=["Operaciones TI autorizadas"])
ROLES_TI = {"JEFE", "ASISTENTE", "PRACTICANTE"}


def ciclo_actual(db: Session, id_: UUID, v4: bool) -> int:
    if not v4:
        return 1
    return db.execute(text("SELECT ciclo_actual FROM public.incidencias WHERE id = :id"), {"id": id_}).scalar_one()


def observacion_previa(db: Session, id_: UUID, ciclo: int) -> bool:
    return ciclo == 1 or db.execute(text("""
        SELECT 1 FROM public.verificaciones WHERE incidencia_id = :id
        AND ciclo_atencion = :anterior AND resultado = 'Observación' LIMIT 1
    """), {"id": id_, "anterior": ciclo - 1}).scalar_one_or_none() is not None


def asignacion_activa(db: Session, id_: UUID):
    return db.scalar(select(Asignacion).where(Asignacion.incidencia_id == id_,
        Asignacion.fecha_fin.is_(None)).order_by(Asignacion.fecha_asignacion.desc(), Asignacion.id.desc()).limit(1))


def consultar_ticket(db: Session, id_: UUID, usuario: Usuario, bloquear=False):
    if not bloquear:
        exigir_lectura_tecnica(db, id_, usuario)
    consulta = select(Incidencia).where(Incidencia.id == id_)
    ticket = db.scalar(consulta.with_for_update() if bloquear else consulta)
    if ticket is None or (usuario.rol == "REPRESENTANTE" and ticket.area_id != usuario.area_id):
        raise HTTPException(404, "Incidencia no encontrada.")
    return ticket


class ContextoToma(BaseModel):
    incidencia_id: UUID
    ciclo_actual: int
    esquema_v4: bool
    puede_tomar: bool
    motivo: str
    ruta_toma: str


@router.get("/{incidencia_id}/contexto-toma", response_model=ContextoToma)
def consultar_toma(incidencia_id: UUID, usuario: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    if usuario.rol not in ROLES_TI:
        raise HTTPException(403, "Solo personal TI autorizado puede tomar incidencias.")
    ticket = consultar_ticket(db, incidencia_id, usuario)
    v4 = esquema_v4_disponible(db)
    ciclo = ciclo_actual(db, incidencia_id, v4)
    activa = asignacion_activa(db, incidencia_id)
    motivo = "Incidencia libre para atención propia."
    puede = ticket.estado in {"Pendiente", "En revisión"} and activa is None
    if ticket.estado == "Cerrado":
        motivo = "Una incidencia cerrada no puede tomarse."
    elif activa is not None:
        motivo = "Ya eres responsable de esta incidencia." if activa.tecnico_id == usuario.id else "Ya existe un responsable activo."
    elif not observacion_previa(db, incidencia_id, ciclo):
        puede = False
        motivo = "El ciclo no tiene una observación anterior válida."
    ruta = f"/api/v4/incidencias/{incidencia_id}/tomar" if ciclo > 1 else f"/api/asignaciones/{incidencia_id}/tomar"
    return ContextoToma(incidencia_id=incidencia_id, ciclo_actual=ciclo, esquema_v4=v4,
        puede_tomar=puede, motivo=motivo, ruta_toma=ruta)


class ContextoPrioridad(BaseModel):
    incidencia_id: UUID
    ciclo_actual: int
    impacto: str | None
    sugerida: Prioridad | None
    oficial: str | None
    provisional: Prioridad | None
    revision_pendiente: bool
    version: UUID | None
    actor_id: UUID | None
    fecha: datetime | None
    justificacion: str | None
    puede_establecer: bool
    operacion: str | None
    motivo: str


def preparar_contexto(db: Session, ticket: Incidencia, usuario: Usuario, v4: bool) -> ContextoPrioridad:
    ciclo = ciclo_actual(db, ticket.id, v4)
    ultimo = ultimos_eventos(db, {ticket.id: ciclo}).get(ticket.id)
    evento, datos = ultimo if ultimo else (None, None)
    provisional = datos.nueva if datos and datos.provisional and ticket.prioridad is None else None
    puede = usuario.rol == "JEFE"
    motivo = "El JEFE puede confirmar o modificar la prioridad con justificación."
    if usuario.rol != "JEFE":
        puede = False
        motivo = "La prioridad oficial corresponde al JEFE."
        if usuario.rol == "ASISTENTE" and ticket.estado == "En revisión" and ticket.prioridad is None and provisional is None:
            activa = asignacion_activa(db, ticket.id)
            propia = activa is not None and activa.tecnico_id == usuario.id and activa.origen_asignacion == "AUTOTOMA"
            if propia and v4:
                propia = db.execute(text("SELECT ciclo_atencion FROM public.asignaciones WHERE id = :id"),
                    {"id": activa.id}).scalar_one() == ciclo
            puede = propia
            if puede:
                motivo = "Solo prioridad inicial provisional por AUTOTOMA, pendiente de revisión del JEFE."
    if not observacion_previa(db, ticket.id, ciclo):
        puede = False
        motivo = "El ciclo no tiene una observación anterior válida."
    return ContextoPrioridad(incidencia_id=ticket.id, ciclo_actual=ciclo, impacto=ticket.impacto,
        sugerida=sugerir_prioridad(ticket.impacto), oficial=ticket.prioridad, provisional=provisional,
        revision_pendiente=provisional is not None, version=evento.id if evento else None,
        actor_id=evento.usuario_id if evento else None, fecha=evento.fecha_registro if evento else None,
        justificacion=datos.justificacion if datos else None, puede_establecer=puede,
        operacion=("confirmacion" if usuario.rol == "JEFE" else "provisional") if puede else None, motivo=motivo)


@router.get("/{incidencia_id}/contexto-prioridad", response_model=ContextoPrioridad)
def consultar_prioridad(incidencia_id: UUID, usuario: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    if usuario.rol not in ROLES_TI | {"REPRESENTANTE"}:
        raise HTTPException(403, "Perfil no autorizado.")
    ticket = consultar_ticket(db, incidencia_id, usuario)
    return preparar_contexto(db, ticket, usuario, esquema_v4_disponible(db))


class PrioridadCrear(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    prioridad: Prioridad
    justificacion: str = Field(min_length=5, max_length=1000)
    ciclo_actual: int = Field(ge=1)
    version: UUID | None
    anterior: str | None = Field(max_length=15)


@router.post("/{incidencia_id}/prioridad", response_model=ContextoPrioridad, status_code=status.HTTP_201_CREATED)
def establecer_prioridad(incidencia_id: UUID, datos: PrioridadCrear,
        usuario: Usuario = Depends(get_current_user), db: Session = Depends(get_db)):
    if usuario.rol not in {"JEFE", "ASISTENTE"}:
        raise HTTPException(403, "Este perfil no puede establecer prioridad.")
    try:
        ticket = consultar_ticket(db, incidencia_id, usuario, bloquear=True)
        db.refresh(usuario)
        if not usuario.habilitado or usuario.rol not in {"JEFE", "ASISTENTE"}:
            raise HTTPException(403, "Perfil sin autorización vigente.")
        v4 = esquema_v4_disponible(db)
        contexto = preparar_contexto(db, ticket, usuario, v4)
        if (contexto.ciclo_actual != datos.ciclo_actual or contexto.version != datos.version or ticket.prioridad != datos.anterior):
            raise HTTPException(409, "La prioridad o el ciclo cambiaron. Actualiza antes de continuar.")
        if not contexto.puede_establecer:
            raise HTTPException(403, contexto.motivo)
        provisional = usuario.rol == "ASISTENTE"
        auditoria = DatosPrioridad(ciclo=contexto.ciclo_actual, rol_actor=usuario.rol,
            anterior=ticket.prioridad, nueva=datos.prioridad, justificacion=datos.justificacion,
            impacto=ticket.impacto, provisional=provisional)
        accion = "PRIORIDAD_PROVISIONAL" if provisional else "PRIORIDAD_CONFIRMADA"
        if not provisional:
            ticket.prioridad = datos.prioridad
        descripcion = auditoria.model_dump_json()
        # Registrar el momento después de obtener el bloqueo, no el inicio
        # de una transacción que pudo esperar a otro escritor.
        fecha = db.execute(select(func.clock_timestamp())).scalar_one()
        if v4:
            db.execute(text("""INSERT INTO public.historial_incidencias
                (incidencia_id, usuario_id, accion, descripcion, ciclo_atencion, fecha_registro)
                VALUES (:id, :actor, :accion, :descripcion, :ciclo, :fecha)"""),
                {"id": ticket.id, "actor": usuario.id, "accion": accion, "descripcion": descripcion,
                 "ciclo": contexto.ciclo_actual, "fecha": fecha})
        else:
            db.add(HistorialIncidencia(incidencia_id=ticket.id, usuario_id=usuario.id,
                accion=accion, descripcion=descripcion, fecha_registro=fecha))
        db.flush()
        salida = preparar_contexto(db, ticket, usuario, v4)
        db.commit()
        return salida
    except Exception:
        db.rollback()
        raise
