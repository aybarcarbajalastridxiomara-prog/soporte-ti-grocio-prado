
from datetime import datetime
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    model_validator,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import (
    Asignacion,
    HistorialIncidencia,
    Incidencia,
    Intervencion,
    Usuario,
)


router = APIRouter(
    prefix="/api/incidencias",
    tags=["Atencion tecnica"],
)


class IntervencionCrear(BaseModel):
    """Datos de la atencion tecnica."""

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    diagnostico: str = Field(min_length=1)
    acciones_realizadas: str = Field(min_length=1)

    duracion_minutos: int | None = Field(
        default=None,
        ge=0,
    )

    solucion_aplicada: str | None = None
    es_solucion_final: bool = False

    @model_validator(mode="after")
    def validar_solucion(self):
        if self.es_solucion_final:
            if not self.solucion_aplicada:
                raise ValueError(
                    "Debe describir la solucion final."
                )
        return self


class IntervencionRespuesta(BaseModel):
    """Resultado del registro tecnico."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    incidencia_id: UUID
    tecnico_id: UUID
    diagnostico: str
    acciones_realizadas: str
    duracion_minutos: int | None
    solucion_aplicada: str | None
    es_solucion_final: bool
    fecha_registro: datetime


@router.post(
    "/{incidencia_id}/intervenciones",
    response_model=IntervencionRespuesta,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar atencion tecnica",
)
def registrar_intervencion(
    incidencia_id: UUID,
    datos: IntervencionCrear,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registra una intervencion del tecnico responsable."""

    # Solo personal tecnico autorizado.
    if usuario_actual.rol not in {
        "ASISTENTE",
        "PRACTICANTE",
    }:
        raise HTTPException(
            status_code=403,
            detail="No tiene permiso para registrar atenciones.",
        )

    try:
        # Bloquear la incidencia durante la operacion.
        incidencia = db.scalar(
            select(Incidencia)
            .where(Incidencia.id == incidencia_id)
            .with_for_update()
        )

        if incidencia is None:
            raise HTTPException(
                status_code=404,
                detail="Incidencia no encontrada.",
            )

        if incidencia.estado == "Cerrado":
            raise HTTPException(
                status_code=409,
                detail="No se puede atender una incidencia cerrada.",
            )

        if incidencia.estado != "En revisión":
            raise HTTPException(
                status_code=409,
                detail="La incidencia aun no esta en revision.",
            )

        # Obtener la asignacion activa del ticket.
        asignacion = db.scalar(
            select(Asignacion).where(
                Asignacion.incidencia_id == incidencia_id,
                Asignacion.fecha_fin.is_(None),
            )
        )

        if asignacion is None:
            raise HTTPException(
                status_code=409,
                detail="La incidencia no tiene responsable activo.",
            )

        # Impedir intervenir tickets de otro tecnico.
        if asignacion.tecnico_id != usuario_actual.id:
            raise HTTPException(
                status_code=403,
                detail="La incidencia esta asignada a otro tecnico.",
            )

        nueva = Intervencion(
            incidencia_id=incidencia_id,
            tecnico_id=usuario_actual.id,
            diagnostico=datos.diagnostico,
            acciones_realizadas=datos.acciones_realizadas,
            duracion_minutos=datos.duracion_minutos,
            solucion_aplicada=datos.solucion_aplicada,
            es_solucion_final=datos.es_solucion_final,
        )

        db.add(nueva)
        db.flush()

        evento = HistorialIncidencia(
            incidencia_id=incidencia_id,
            usuario_id=usuario_actual.id,
            accion="INTERVENCION",
            descripcion=(
                "Atencion tecnica registrada. "
                f"Diagnostico: {datos.diagnostico}. "
                f"Acciones: {datos.acciones_realizadas}. "
                f"Solucion: {datos.solucion_aplicada or 'Pendiente'}."
            ),
        )

        db.add(evento)
        db.flush()

        respuesta = IntervencionRespuesta.model_validate(
            nueva
        )

        # La intervencion no cierra automaticamente el ticket.
        db.commit()

        return respuesta

    except Exception:
        db.rollback()
        raise
