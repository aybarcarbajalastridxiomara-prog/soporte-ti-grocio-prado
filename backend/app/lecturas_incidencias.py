"""Lecturas operativas; no modifica datos ni requiere migraciones V4."""
from fastapi import HTTPException
from sqlalchemy import and_, false, func, literal_column, or_, select, true
from sqlalchemy.orm import Session

from app.models import Area, Asignacion, Incidencia, Intervencion, Usuario
from app.v4_esquema import esquema_v4_disponible
from app.prioridades import ultimos_eventos


def condicion_visibilidad(usuario: Usuario):
    """TI conserva casos libres y participación propia, sin abrir casos ajenos."""
    if usuario.rol == "JEFE":
        return true()
    if usuario.rol == "REPRESENTANTE":
        return Incidencia.area_id == usuario.area_id
    if usuario.rol not in {"ASISTENTE", "PRACTICANTE"}:
        return false()
    propia = select(Asignacion.id).where(
        Asignacion.incidencia_id == Incidencia.id,
        Asignacion.tecnico_id == usuario.id,
    ).correlate(Incidencia).exists()
    activa = select(Asignacion.id).where(
        Asignacion.incidencia_id == Incidencia.id,
        Asignacion.fecha_fin.is_(None),
    ).correlate(Incidencia).exists()
    return or_(propia, Incidencia.cerrado_por_usuario_id == usuario.id,
        and_(Incidencia.estado.in_(["Pendiente", "En revisión"]), ~activa))


def exigir_lectura_tecnica(db: Session, incidencia_id, usuario: Usuario):
    if usuario.rol in {"ASISTENTE", "PRACTICANTE"} and db.scalar(
        select(Incidencia.id).where(Incidencia.id == incidencia_id,
            condicion_visibilidad(usuario)).limit(1)
    ) is None:
        raise HTTPException(404, "Incidencia no encontrada.")


def condicion_ciclo(db: Session):
    # No referenciar columnas V4 hasta confirmar el esquema completo.
    if esquema_v4_disponible(db):
        return literal_column("asignaciones.ciclo_atencion") == literal_column("incidencias.ciclo_actual")
    return true()


def enriquecer_incidencias(db: Session, incidencias: list[Incidencia], ciclo, *, tecnico_id=None) -> list[dict]:
    if not incidencias:
        return []
    ids = [i.id for i in incidencias]
    ciclos = {i.id: 1 for i in incidencias}
    if not ciclo.compare(true()):
        ciclos = dict(db.execute(select(Incidencia.id, literal_column("incidencias.ciclo_actual"))
            .where(Incidencia.id.in_(ids))).all())
    prioridades = ultimos_eventos(db, ciclos)
    areas = {a.id: a.nombre for a in db.scalars(select(Area).where(Area.id.in_({i.area_id for i in incidencias})))}
    activas = db.scalars(
        select(Asignacion).join(Incidencia, Incidencia.id == Asignacion.incidencia_id)
        .where(Asignacion.incidencia_id.in_(ids), Asignacion.fecha_fin.is_(None), ciclo)
        .order_by(Asignacion.fecha_asignacion.desc(), Asignacion.id.desc())
    ).all()
    asignaciones = {}
    for asignacion in activas:
        asignaciones.setdefault(asignacion.incidencia_id, asignacion)
    personas = {a.tecnico_id for a in asignaciones.values()} | {i.cerrado_por_usuario_id for i in incidencias if i.cerrado_por_usuario_id}
    nombres = {u.id: u.nombre_completo for u in db.scalars(select(Usuario).where(Usuario.id.in_(personas)))} if personas else {}
    duraciones = {}
    if tecnico_id is not None:
        ciclo_intervencion = true() if ciclo.compare(true()) else (
            literal_column("intervenciones.ciclo_atencion") == literal_column("incidencias.ciclo_actual")
        )
        duraciones = dict(db.execute(
            select(Intervencion.incidencia_id, func.sum(Intervencion.duracion_minutos))
            .join(Incidencia, Incidencia.id == Intervencion.incidencia_id)
            .where(Intervencion.incidencia_id.in_(ids), Intervencion.tecnico_id == tecnico_id, ciclo_intervencion)
            .group_by(Intervencion.incidencia_id)
        ).all())
    salida = []
    for i in incidencias:
        ultimo = prioridades.get(i.id)
        provisional = ultimo[1].nueva if ultimo and ultimo[1].provisional and i.prioridad is None else None
        asignacion = asignaciones.get(i.id)
        tipo = "cierre" if i.estado == "Cerrado" else "activo" if asignacion else "sin_asignar"
        responsable = i.cerrado_por_usuario_id if tipo == "cierre" else asignacion.tecnico_id if asignacion else None
        salida.append(dict(
            id=i.id, codigo=i.codigo, area_id=i.area_id, area_nombre=areas.get(i.area_id),
            asunto=i.asunto, estado=i.estado, prioridad=i.prioridad, fecha_registro=i.fecha_registro,
            prioridad_provisional=provisional, prioridad_revision_pendiente=provisional is not None,
            responsable_id=responsable, responsable_nombre=nombres.get(responsable), responsable_tipo=tipo,
            fecha_asignacion=asignacion.fecha_asignacion if tipo == "activo" and asignacion else None,
            duracion_atencion_minutos=duraciones.get(i.id),
        ))
    return salida
