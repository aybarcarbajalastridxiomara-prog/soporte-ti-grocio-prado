"""Consultas institucionales de solo lectura, compartidas por pantalla y archivos."""
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.lecturas_incidencias import condicion_ciclo, enriquecer_incidencias
from app.models import Area, Asignacion, Incidencia, Usuario
from app.schemas import EstadoIncidencia

MUNICIPALIDAD = "Municipalidad Distrital de Grocio Prado"
LIMA = ZoneInfo("America/Lima")
MAX_FILAS_EXPORTACION = 5000
MAX_BYTES_EXPORTACION = 4_000_000


class FiltrosReporte(BaseModel):
    model_config = ConfigDict(extra="forbid")

    desde: date | None = None
    hasta: date | None = None
    area_id: UUID | None = None
    estado: EstadoIncidencia | None = None
    prioridad: Literal["Alta", "Media", "Baja", "sin_evaluar", "no_clasificada"] | None = None
    responsable_id: UUID | Literal["sin_responsable"] | None = None

    @model_validator(mode="after")
    def validar_periodo(self):
        if self.desde and self.hasta and self.desde > self.hasta:
            raise ValueError("La fecha inicial no puede ser posterior a la final.")
        if self.hasta == date.max:
            raise ValueError("La fecha final está fuera del rango admitido.")
        return self


class ConsultaReporte(FiltrosReporte):
    pagina: int = Field(default=1, ge=1, le=1_000_000)
    tamano_pagina: int = Field(default=25, ge=1, le=100)


class ExportarReporte(FiltrosReporte):
    formato: Literal["pdf", "xlsx"]


def filtros_solamente(consulta: FiltrosReporte) -> FiltrosReporte:
    return FiltrosReporte.model_validate(consulta.model_dump(include=set(FiltrosReporte.model_fields)))


def preparar_base(db: Session, filtros: FiltrosReporte):
    """Una fila por incidencia; una asignación histórica nunca multiplica el conteo."""
    ciclo = condicion_ciclo(db)
    activo = (select(Asignacion.tecnico_id)
        .where(Asignacion.incidencia_id == Incidencia.id, Asignacion.fecha_fin.is_(None), ciclo)
        .order_by(Asignacion.fecha_asignacion.desc(), Asignacion.id.desc())
        .limit(1).correlate(Incidencia).scalar_subquery())
    responsable = case((Incidencia.estado == "Cerrado", Incidencia.cerrado_por_usuario_id), else_=activo)
    consulta = select(Incidencia.id, Incidencia.area_id, Incidencia.estado, Incidencia.prioridad,
        Incidencia.fecha_registro, responsable.label("responsable_id"))
    if filtros.desde:
        inicio = datetime.combine(filtros.desde, time.min, LIMA).astimezone(timezone.utc)
        consulta = consulta.where(Incidencia.fecha_registro >= inicio)
    if filtros.hasta:
        fin = datetime.combine(filtros.hasta + timedelta(days=1), time.min, LIMA).astimezone(timezone.utc)
        consulta = consulta.where(Incidencia.fecha_registro < fin)
    if filtros.area_id:
        consulta = consulta.where(Incidencia.area_id == filtros.area_id)
    if filtros.estado:
        consulta = consulta.where(Incidencia.estado == filtros.estado)
    if filtros.prioridad == "sin_evaluar":
        consulta = consulta.where(Incidencia.prioridad.is_(None))
    elif filtros.prioridad == "no_clasificada":
        consulta = consulta.where(Incidencia.prioridad.is_not(None), ~Incidencia.prioridad.in_(["Alta", "Media", "Baja"]))
    elif filtros.prioridad:
        consulta = consulta.where(Incidencia.prioridad == filtros.prioridad)
    if filtros.responsable_id == "sin_responsable":
        consulta = consulta.where(responsable.is_(None))
    elif filtros.responsable_id:
        consulta = consulta.where(responsable == filtros.responsable_id)
    return consulta.cte("incidencias_reportadas"), ciclo


def metadatos(db: Session, filtros: FiltrosReporte) -> dict:
    from fastapi import HTTPException

    area = db.get(Area, filtros.area_id) if filtros.area_id else None
    if filtros.area_id and area is None:
        raise HTTPException(422, "El área seleccionada no existe.")
    persona = db.get(Usuario, filtros.responsable_id) if isinstance(filtros.responsable_id, UUID) else None
    if isinstance(filtros.responsable_id, UUID) and persona is None:
        raise HTTPException(422, "El responsable seleccionado no existe.")
    periodo = f"{filtros.desde.isoformat() if filtros.desde else 'Sin límite inicial'} al {filtros.hasta.isoformat() if filtros.hasta else 'Sin límite final'}"
    return dict(organizacion=MUNICIPALIDAD, fecha_generacion=datetime.now(timezone.utc),
        periodo=periodo, zona_horaria="America/Lima", parametros=filtros.model_dump(mode="json"),
        filtros_aplicados={
            "Fecha de registro": periodo,
            "Área municipal": area.nombre if area else "Todas las áreas",
            "Estado": filtros.estado or "Todos los estados",
            "Prioridad oficial": {"sin_evaluar": "Pendiente de evaluación", "no_clasificada": "No clasificada"}.get(filtros.prioridad, filtros.prioridad or "Todas las prioridades"),
            "Responsable actual o de cierre": persona.nombre_completo if persona else "Sin responsable" if filtros.responsable_id else "Todos los responsables",
        })


def resumen_y_desgloses(db: Session, base) -> dict:
    resumen = dict(db.execute(select(func.count().label("total"),
        func.count().filter(base.c.estado == "Pendiente").label("pendientes"),
        func.count().filter(base.c.estado == "En revisión").label("en_revision"),
        func.count().filter(base.c.estado == "Cerrado").label("cerradas")).select_from(base)).mappings().one())
    areas = db.execute(select(base.c.area_id.label("id"), Area.nombre.label("nombre"), func.count().label("total"))
        .select_from(base).outerjoin(Area, Area.id == base.c.area_id)
        .group_by(base.c.area_id, Area.nombre).order_by(func.count().desc(), Area.nombre, base.c.area_id)).mappings().all()
    prioridad = case((base.c.prioridad.is_(None), "Pendiente de evaluación"),
        (base.c.prioridad.in_(["Alta", "Media", "Baja"]), base.c.prioridad), else_="No clasificada")
    prioridades = db.execute(select(prioridad.label("nombre"), func.count().label("total"))
        .select_from(base).group_by(prioridad).order_by(func.count().desc(), prioridad)).mappings().all()
    responsables = db.execute(select(base.c.responsable_id.label("id"),
        func.coalesce(Usuario.nombre_completo, "Sin responsable").label("nombre"), func.count().label("total"))
        .select_from(base).outerjoin(Usuario, Usuario.id == base.c.responsable_id)
        .group_by(base.c.responsable_id, Usuario.nombre_completo)
        .order_by(func.count().desc(), Usuario.nombre_completo, base.c.responsable_id)).mappings().all()
    return dict(resumen=resumen, desgloses={"areas": [dict(f) for f in areas],
        "prioridades": [dict(f) for f in prioridades], "responsables": [dict(f) for f in responsables]})


def filas_reporte(db: Session, base, ciclo, *, limite: int, desplazamiento: int = 0) -> list[dict]:
    registros = db.scalars(select(Incidencia).join(base, base.c.id == Incidencia.id)
        .order_by(Incidencia.fecha_registro.desc(), Incidencia.id.desc())
        .offset(desplazamiento).limit(limite)).all()
    return enriquecer_incidencias(db, registros, ciclo)
