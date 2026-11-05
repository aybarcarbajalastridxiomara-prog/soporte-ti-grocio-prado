
from datetime import date, datetime, time
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)


EstadoIncidencia = Literal[
    "Pendiente",
    "En revisión",
    "Cerrado",
]

Impacto = Literal[
    "Si",
    "Parcialmente",
    "No",
]


class IncidenciaCrear(BaseModel):
    """Datos enviados por el representante municipal."""

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    asunto: str = Field(min_length=1, max_length=200)
    descripcion: str = Field(min_length=1)

    categoria: str | None = Field(
        default=None, max_length=80
    )

    equipo_sistema_afectado: str | None = Field(
        default=None, max_length=150
    )

    ubicacion: str | None = Field(
        default=None, max_length=150
    )

    impacto: Impacto | None = None

    fecha_inicio_problema: date | None = None
    hora_inicio_problema: time | None = None

    reincidente: bool = False
    incidencia_anterior_id: UUID | None = None

    detalle_reincidencia: str | None = Field(
        default=None, max_length=2000
    )

    @model_validator(mode="after")
    def validar_reincidencia(self):
        if not self.reincidente:
            if self.incidencia_anterior_id is not None:
                raise ValueError(
                    "Debe marcar que el problema es recurrente."
                )
        return self


class IncidenciaLectura(IncidenciaCrear):
    """Datos visibles al consultar una incidencia."""

    id: UUID
    codigo: str
    area_id: UUID
    reportante_id: UUID

    estado: EstadoIncidencia
    prioridad: str | None = None

    fecha_registro: datetime
    fecha_cierre: datetime | None = None
    cerrado_por_usuario_id: UUID | None = None


class VerificacionCrear(BaseModel):
    """Conformidad u observación del área solicitante."""

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    resultado: Literal[
        "Conformidad",
        "Observación",
    ]

    observaciones: str | None = Field(
        default=None, max_length=2000
    )

    @model_validator(mode="after")
    def validar_observacion(self):
        if self.resultado == "Observación":
            if not self.observaciones:
                raise ValueError(
                    "Debe describir la observación."
                )
        return self
