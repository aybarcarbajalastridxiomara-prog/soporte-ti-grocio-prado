"""Consultas para el formulario de asignacion del frontend real (paso 110D2A).

Solo lectura. Compatible con esquemas V3 y V4. No crea ni asigna tickets.
La autorizacion para consultar estos datos corresponde al JEFE.
"""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Asignacion, Incidencia, Usuario
from app.v4_esquema import esquema_v4_disponible


router = APIRouter(prefix="/api", tags=["Consultas de asignacion"])


class TecnicoDisponible(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre_completo: str
    usuario: str
    rol: str


class TecnicoActivo(BaseModel):
    id: UUID
    nombre_completo: str
    rol: str
    fecha_asignacion: datetime


class ContextoAsignacionRespuesta(BaseModel):
    incidencia_id: UUID
    codigo: str
    estado: str
    esquema_v4: bool
    ciclo_actual: int
    tecnico_activo: TecnicoActivo | None
    puede_asignar: bool
    ruta_asignacion: str


def requerir_jefe(usuario: Usuario) -> None:
    if usuario.rol != "JEFE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el Jefe de Sistemas puede consultar asignaciones.",
        )


@router.get(
    "/tecnicos",
    response_model=list[TecnicoDisponible],
    summary="Listar asistentes y practicantes habilitados",
)
def listar_tecnicos(
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Expone solo los campos necesarios para seleccionar al responsable."""
    requerir_jefe(usuario_actual)

    consulta = (
        select(Usuario)
        .where(
            Usuario.habilitado.is_(True),
            Usuario.rol.in_(("ASISTENTE", "PRACTICANTE")),
        )
        .order_by(Usuario.nombre_completo.asc(), Usuario.id.asc())
    )
    return db.scalars(consulta).all()


@router.get(
    "/incidencias/{incidencia_id}/contexto-asignacion",
    response_model=ContextoAsignacionRespuesta,
    summary="Consultar ciclo y responsable antes de asignar",
)
def consultar_contexto_asignacion(
    incidencia_id: UUID,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Indica la ruta correcta de asignacion sin alterar la base de datos."""
    requerir_jefe(usuario_actual)

    incidencia = db.get(Incidencia, incidencia_id)
    if incidencia is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Incidencia no encontrada.",
        )

    v4 = esquema_v4_disponible(db)
    ciclo = 1
    if v4:
        # El campo ciclo_actual existe solamente cuando V4 esta completa.
        ciclo = db.execute(
            text("""
                SELECT ciclo_actual
                FROM public.incidencias
                WHERE id = :incidencia_id
            """),
            {"incidencia_id": incidencia_id},
        ).scalar_one()

    actual = db.execute(
        select(
            Asignacion.tecnico_id.label("id"),
            Usuario.nombre_completo,
            Usuario.rol,
            Asignacion.fecha_asignacion,
        )
        .join(Usuario, Usuario.id == Asignacion.tecnico_id)
        .where(
            Asignacion.incidencia_id == incidencia_id,
            Asignacion.fecha_fin.is_(None),
        )
        .order_by(
            Asignacion.fecha_asignacion.desc(),
            Asignacion.id.desc(),
        )
        .limit(1)
    ).mappings().one_or_none()

    tecnico_activo = (
        TecnicoActivo.model_validate(dict(actual))
        if actual is not None else None
    )

    # Los permisos y la disponibilidad se vuelven a validar en POST.
    puede_asignar = (
        tecnico_activo is None
        and (
            (ciclo == 1 and incidencia.estado in {"Pendiente", "En revisión"})
            or (ciclo > 1 and incidencia.estado == "En revisión")
        )
    )
    ruta = (
        f"/api/v4/incidencias/{incidencia_id}/asignar"
        if ciclo > 1
        else f"/api/asignaciones/{incidencia_id}/asignar"
    )

    return ContextoAsignacionRespuesta(
        incidencia_id=incidencia_id,
        codigo=incidencia.codigo,
        estado=incidencia.estado,
        esquema_v4=v4,
        ciclo_actual=ciclo,
        tecnico_activo=tecnico_activo,
        puede_asignar=puede_asignar,
        ruta_asignacion=ruta,
    )
