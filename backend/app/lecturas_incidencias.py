"""Lecturas operativas; no modifica datos ni requiere migraciones V4."""
from sqlalchemy import literal_column, select, true
from sqlalchemy.orm import Session

from app.models import Area, Asignacion, Incidencia, Usuario
from app.v4_esquema import esquema_v4_disponible


def condicion_ciclo(db: Session):
    # No referenciar columnas V4 hasta confirmar el esquema completo.
    if esquema_v4_disponible(db):
        return literal_column("asignaciones.ciclo_atencion") == literal_column("incidencias.ciclo_actual")
    return true()


def enriquecer_incidencias(db: Session, incidencias: list[Incidencia], ciclo) -> list[dict]:
    if not incidencias:
        return []
    ids = [i.id for i in incidencias]
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
        tipo = "cierre" if i.estado == "Cerrado" else "activo" if i.id in responsables else "sin_asignar"
        responsable = i.cerrado_por_usuario_id if tipo == "cierre" else responsables.get(i.id)
        salida.append(dict(
            id=i.id, codigo=i.codigo, area_id=i.area_id, area_nombre=areas.get(i.area_id),
            asunto=i.asunto, estado=i.estado, prioridad=i.prioridad, fecha_registro=i.fecha_registro,
            responsable_id=responsable, responsable_nombre=nombres.get(responsable), responsable_tipo=tipo,
        ))
    return salida
