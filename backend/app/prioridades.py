"""Prioridad oficial y propuesta provisional, sin nuevas columnas ni migraciones."""
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import HistorialIncidencia

Prioridad = Literal["Alta", "Media", "Baja"]
ACCIONES = ("PRIORIDAD_PROVISIONAL", "PRIORIDAD_CONFIRMADA")


def sugerir_prioridad(impacto: str | None) -> Prioridad | None:
    return {"Si": "Alta", "Parcialmente": "Media", "No": "Baja"}.get(impacto)


class DatosPrioridad(BaseModel):
    model_config = ConfigDict(extra="forbid")
    formato: Literal["prioridad-112c-v1"] = "prioridad-112c-v1"
    ciclo: int = Field(ge=1)
    rol_actor: Literal["JEFE", "ASISTENTE"]
    anterior: str | None
    nueva: Prioridad
    justificacion: str
    impacto: str | None
    provisional: bool


def datos_evento(evento: HistorialIncidencia) -> DatosPrioridad | None:
    try:
        datos = DatosPrioridad.model_validate_json(evento.descripcion)
    except (ValidationError, ValueError):
        return None
    if (evento.accion == "PRIORIDAD_PROVISIONAL" and datos.provisional and datos.rol_actor == "ASISTENTE") or (
        evento.accion == "PRIORIDAD_CONFIRMADA" and not datos.provisional and datos.rol_actor == "JEFE"
    ):
        return datos
    return None


def ultimos_eventos(db: Session, ciclos: dict[UUID, int]) -> dict[UUID, tuple[HistorialIncidencia, DatosPrioridad]]:
    if not ciclos:
        return {}
    resultado = {}
    eventos = db.scalars(select(HistorialIncidencia).where(
        HistorialIncidencia.incidencia_id.in_(ciclos), HistorialIncidencia.accion.in_(ACCIONES)
    ).order_by(HistorialIncidencia.fecha_registro.desc(), HistorialIncidencia.id.desc()))
    for evento in eventos:
        if evento.incidencia_id in resultado:
            continue
        datos = datos_evento(evento)
        if datos and datos.ciclo == ciclos[evento.incidencia_id]:
            resultado[evento.incidencia_id] = (evento, datos)
    return resultado
