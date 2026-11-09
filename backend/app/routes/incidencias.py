
from datetime import date, datetime, time, timezone
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from pydantic import BaseModel, ConfigDict, Field
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

from app.schemas import (
    EstadoIncidencia,
    IncidenciaCrear,
)


router = APIRouter(
    prefix="/api/incidencias",
    tags=["Incidencias"],
)


class IncidenciaResumen(BaseModel):
    """Datos principales de una incidencia."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    codigo: str
    area_id: UUID
    asunto: str
    estado: EstadoIncidencia
    prioridad: str | None
    fecha_registro: datetime

class IncidenciaDetalle(BaseModel):
    """Informacion completa de una incidencia."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    codigo: str
    area_id: UUID
    reportante_id: UUID

    asunto: str
    descripcion: str

    categoria: str | None
    equipo_sistema_afectado: str | None
    ubicacion: str | None
    impacto: str | None

    fecha_inicio_problema: date | None
    hora_inicio_problema: time | None

    incidencia_anterior_id: UUID | None
    detalle_reincidencia: str | None

    estado: EstadoIncidencia
    prioridad: str | None

    fecha_registro: datetime
    fecha_cierre: datetime | None
    cerrado_por_usuario_id: UUID | None


class EventoHistorial(BaseModel):
    """Representa una accion registrada sobre un ticket."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    usuario_id: UUID
    accion: str
    descripcion: str
    fecha_registro: datetime


class CierreCrear(BaseModel):
    """Sustento obligatorio para cerrar una incidencia."""

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    resumen_cierre: str = Field(
        min_length=20,
        max_length=2000,
    )


class CierreRespuesta(BaseModel):
    """Resultado del cierre de una incidencia."""

    incidencia_id: UUID
    codigo: str
    estado: EstadoIncidencia
    cerrado_por_usuario_id: UUID
    fecha_cierre: datetime



@router.get(
    "",
    response_model=list[IncidenciaResumen],
    summary="Listar incidencias autorizadas",
)
def listar_incidencias(
    estado: EstadoIncidencia | None = None,
    limite: int = Query(default=50, ge=1, le=100),
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consulta incidencias segun el perfil autorizado."""

    roles_validos = {
        "JEFE",
        "ASISTENTE",
        "PRACTICANTE",
        "REPRESENTANTE",
    }

    if usuario_actual.rol not in roles_validos:
        raise HTTPException(
            status_code=403,
            detail="No tiene permiso para consultar incidencias.",
        )

    consulta = select(Incidencia)

    if usuario_actual.rol == "REPRESENTANTE":
        consulta = consulta.where(
            Incidencia.area_id == usuario_actual.area_id
        )

    if estado is not None:
        consulta = consulta.where(
            Incidencia.estado == estado
        )

    consulta = (
        consulta
        .order_by(
            Incidencia.fecha_registro.desc(),
            Incidencia.id.desc(),
        )
        .limit(limite)
    )

    return db.scalars(consulta).all()


@router.post(
    "",
    response_model=IncidenciaResumen,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar nueva incidencia",
)
def registrar_incidencia(
    datos: IncidenciaCrear,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registra una incidencia de un area municipal."""

    # Solo los representantes municipales registran tickets.
    if usuario_actual.rol != "REPRESENTANTE":
        raise HTTPException(
            status_code=403,
            detail=(
                "Solo los representantes municipales "
                "pueden registrar incidencias."
            ),
        )

    # Validar la referencia a una incidencia anterior.
    if datos.reincidente:
        if datos.incidencia_anterior_id is None:
            raise HTTPException(
                status_code=422,
                detail="Indique la incidencia anterior.",
            )

        anterior = db.get(
            Incidencia,
            datos.incidencia_anterior_id,
        )

        if anterior is None or (
            anterior.area_id != usuario_actual.area_id
        ):
            raise HTTPException(
                status_code=404,
                detail="Incidencia anterior no disponible.",
            )

        if anterior.estado != "Cerrado":
            raise HTTPException(
                status_code=409,
                detail=(
                    "La incidencia anterior debe estar "
                    "cerrada para registrar una recurrencia."
                ),
            )

    elif datos.detalle_reincidencia:
        raise HTTPException(
            status_code=422,
            detail=(
                "Marque la incidencia como recurrente "
                "para registrar el detalle."
            ),
        )

    # El usuario no puede establecer estado, prioridad
    # ni area solicitante.
    campos = datos.model_dump(
        exclude={
            "reincidente",
            "incidencia_anterior_id",
            "detalle_reincidencia",
        }
    )

    nueva = Incidencia(
        **campos,
        area_id=usuario_actual.area_id,
        reportante_id=usuario_actual.id,
        incidencia_anterior_id=(
            datos.incidencia_anterior_id
            if datos.reincidente else None
        ),
        detalle_reincidencia=(
            datos.detalle_reincidencia
            if datos.reincidente else None
        ),
        estado="Pendiente",
        prioridad=None,
    )

    try:
        db.add(nueva)
        db.flush()

        # Conservar la creacion en el historial.
        evento = HistorialIncidencia(
            incidencia_id=nueva.id,
            usuario_id=usuario_actual.id,
            accion="CREACION",
            descripcion=(
                "Incidencia registrada por "
                "representante municipal."
            ),
        )

        db.add(evento)
        db.flush()

        respuesta = IncidenciaResumen.model_validate(
            nueva
        )

        # Guardar ticket e historial en una transaccion.
        db.commit()

        return respuesta

    except Exception:
        db.rollback()
        raise



@router.get(
    "/{incidencia_id}",
    response_model=IncidenciaDetalle,
    summary="Consultar detalle de una incidencia",
)
def consultar_detalle_incidencia(
    incidencia_id: UUID,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consulta una incidencia mediante su identificador."""

    roles_validos = {
        "JEFE",
        "ASISTENTE",
        "PRACTICANTE",
        "REPRESENTANTE",
    }

    if usuario_actual.rol not in roles_validos:
        raise HTTPException(
            status_code=403,
            detail="No tiene permiso para consultar incidencias.",
        )

    incidencia = db.get(Incidencia, incidencia_id)

    if incidencia is None:
        raise HTTPException(
            status_code=404,
            detail="Incidencia no encontrada.",
        )

    # Los representantes solo consultan su propia area.
    if usuario_actual.rol == "REPRESENTANTE":
        if incidencia.area_id != usuario_actual.area_id:
            raise HTTPException(
                status_code=404,
                detail="Incidencia no encontrada.",
            )

    return incidencia


@router.get(
    "/{incidencia_id}/historial",
    response_model=list[EventoHistorial],
    summary="Consultar historial de una incidencia",
)
def consultar_historial_incidencia(
    incidencia_id: UUID,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consulta las acciones registradas sobre una incidencia."""

    roles_validos = {
        "JEFE",
        "ASISTENTE",
        "PRACTICANTE",
        "REPRESENTANTE",
    }

    if usuario_actual.rol not in roles_validos:
        raise HTTPException(
            status_code=403,
            detail="No tiene permiso para consultar el historial.",
        )

    incidencia = db.get(Incidencia, incidencia_id)

    if incidencia is None:
        raise HTTPException(
            status_code=404,
            detail="Incidencia no encontrada.",
        )

    if usuario_actual.rol == "REPRESENTANTE":
        if incidencia.area_id != usuario_actual.area_id:
            raise HTTPException(
                status_code=404,
                detail="Incidencia no encontrada.",
            )

    consulta = (
        select(HistorialIncidencia)
        .where(
            HistorialIncidencia.incidencia_id == incidencia_id
        )
        .order_by(
            HistorialIncidencia.fecha_registro.asc(),
            HistorialIncidencia.id.asc(),
        )
    )

    return db.scalars(consulta).all()



@router.post(
    "/{incidencia_id}/cerrar",
    response_model=CierreRespuesta,
    summary="Cerrar una incidencia atendida",
)
def cerrar_incidencia(
    incidencia_id: UUID,
    datos: CierreCrear,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cierra una incidencia con sustento tecnico."""

    
    # Jefe, asistente y practicante pueden cerrar
    # incidencias bajo su responsabilidad.
    if usuario_actual.rol not in {
        "JEFE",
        "ASISTENTE",
        "PRACTICANTE",
    }:

        raise HTTPException(
            status_code=403,
            detail="No tiene permiso para cerrar incidencias.",
        )

    try:
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
                detail="La incidencia ya se encuentra cerrada.",
            )

        if incidencia.estado != "En revisión":
            raise HTTPException(
                status_code=409,
                detail="La incidencia debe estar en revision.",
            )

        # Comprobar la asignacion activa.
        asignacion = db.scalar(
            select(Asignacion).where(
                Asignacion.incidencia_id == incidencia_id,
                Asignacion.fecha_fin.is_(None),
            )
        )

        if asignacion is None:
            raise HTTPException(
                status_code=409,
                detail="La incidencia no tiene responsable.",
            )

        if asignacion.tecnico_id != usuario_actual.id:
            raise HTTPException(
                status_code=403,
                detail="Solo el responsable puede cerrar el ticket.",
            )

        # Comprobar la ultima intervencion del responsable.
        ultima = db.scalar(
            select(Intervencion)
            .where(
                Intervencion.incidencia_id == incidencia_id,
                Intervencion.tecnico_id == usuario_actual.id,
            )
            .order_by(
                Intervencion.fecha_registro.desc(),
                Intervencion.id.desc(),
            )
            .limit(1)
        )

        if (
            ultima is None
            or not ultima.es_solucion_final
            or not (ultima.solucion_aplicada or "").strip()
        ):
            raise HTTPException(
                status_code=409,
                detail=(
                    "Registre una intervencion final "
                    "con la solucion aplicada antes de cerrar."
                ),
            )

        fecha = datetime.now(timezone.utc)

        # Registrar el cierre.
        incidencia.estado = "Cerrado"
        incidencia.fecha_cierre = fecha
        incidencia.cerrado_por_usuario_id = usuario_actual.id

        # Finalizar la asignacion activa.
        asignacion.fecha_fin = fecha

        # Registrar la justificacion en el historial.
        evento = HistorialIncidencia(
            incidencia_id=incidencia_id,
            usuario_id=usuario_actual.id,
            accion="CIERRE",
            descripcion=(
                "Cierre tecnico de incidencia. "
                f"Resumen: {datos.resumen_cierre}. "
                f"Solucion aplicada: {ultima.solucion_aplicada}"
            ),
        )

        db.add(evento)
        db.flush()

        respuesta = CierreRespuesta(
            incidencia_id=incidencia.id,
            codigo=incidencia.codigo,
            estado=incidencia.estado,
            cerrado_por_usuario_id=usuario_actual.id,
            fecha_cierre=fecha,
        )

        db.commit()
        return respuesta

    except Exception:
        db.rollback()
        raise


