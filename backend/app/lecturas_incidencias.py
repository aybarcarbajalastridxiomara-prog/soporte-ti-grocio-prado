"""Lecturas operativas; no modifica datos ni requiere migraciones V4."""
from fastapi import HTTPException
from sqlalchemy import and_, false, literal_column, or_, select, true
from sqlalchemy.orm import Session

from app.models import Area, Asignacion, Incidencia, Usuario
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


def enriquecer_incidencias(db: Session, incidencias: list[Incidencia], ciclo) -> list[dict]:
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
    responsables = {}
    for asignacion in activas:
        responsables.setdefault(asignacion.incidencia_id, asignacion.tecnico_id)
    personas = set(responsables.values()) | {i.cerrado_por_usuario_id for i in incidencias if i.cerrado_por_usuario_id}
    nombres = {u.id: u.nombre_completo for u in db.scalars(select(Usuario).where(Usuario.id.in_(personas)))} if personas else {}
    salida = []
    for i in incidencias:
        ultimo = prioridades.get(i.id)
        provisional = ultimo[1].nueva if ultimo and ultimo[1].provisional and i.prioridad is None else None
        tipo = "cierre" if i.estado == "Cerrado" else "activo" if i.id in responsables else "sin_asignar"
        responsable = i.cerrado_por_usuario_id if tipo == "cierre" else responsables.get(i.id)
        salida.append(dict(
            id=i.id, codigo=i.codigo, area_id=i.area_id, area_nombre=areas.get(i.area_id),
            asunto=i.asunto, estado=i.estado, prioridad=i.prioridad, fecha_registro=i.fecha_registro,
            prioridad_provisional=provisional, prioridad_revision_pendiente=provisional is not None,
            responsable_id=responsable, responsable_nombre=nombres.get(responsable), responsable_tipo=tipo,
        ))
    return salida
