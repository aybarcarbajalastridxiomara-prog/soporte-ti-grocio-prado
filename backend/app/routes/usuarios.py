
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.config import get_settings
from app.db import get_db
from app.models import Area, Usuario
from app.supabase_admin import invitar_en_supabase


router = APIRouter(
    prefix="/api",
    tags=["Usuarios"],
)


class MiPerfil(BaseModel):
    """Datos del usuario autenticado."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre_completo: str
    usuario: str
    area_id: UUID
    rol: Literal[
        "JEFE",
        "ASISTENTE",
        "PRACTICANTE",
        "REPRESENTANTE",
    ]
    habilitado: bool
    area_nombre: str | None = None


@router.get(
    "/me",
    response_model=MiPerfil,
    summary="Consultar mi perfil",
)
def consultar_mi_perfil(
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MiPerfil:
    """
    Devuelve los datos del usuario autenticado.

    El backend obtiene la identidad mediante
    Supabase Auth y consulta el perfil autorizado
    en PostgreSQL.
    """

    perfil = MiPerfil.model_validate(usuario_actual)
    area = db.get(Area, usuario_actual.area_id)
    perfil.area_nombre = area.nombre if area is not None else None
    return perfil


RolAdministrado = Literal["JEFE", "ASISTENTE", "PRACTICANTE", "REPRESENTANTE"]


class AreaLectura(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    nombre: str
    activo: bool


class PerfilActualizar(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    nombre_completo: str | None = Field(default=None, min_length=1, max_length=150)
    usuario: str | None = Field(default=None, min_length=3, max_length=80, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_.-]*$")
    area_id: UUID | None = None
    rol: RolAdministrado | None = None
    habilitado: StrictBool | None = None

    @model_validator(mode="after")
    def validar_campos(self):
        if not self.model_fields_set or any(getattr(self, campo) is None for campo in self.model_fields_set):
            raise ValueError("Envíe al menos un campo y no use valores nulos.")
        return self


class UsuarioInvitar(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    correo: str = Field(min_length=5, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    nombre_completo: str = Field(min_length=1, max_length=150)
    usuario: str = Field(min_length=3, max_length=80, pattern=r"^[a-zA-Z0-9][a-zA-Z0-9_.-]*$")
    area_id: UUID
    rol: RolAdministrado


def estado_administracion() -> dict:
    settings = get_settings()
    motivos = []
    if not settings.administracion_perfiles_habilitada:
        motivos.append("La modificación de perfiles requiere habilitación y permisos PostgreSQL por el operador.")
    if not settings.supabase_url or not settings.supabase_service_role_key:
        motivos.append("Falta la credencial privada de administración de Supabase en el servidor.")
    if not settings.supabase_smtp_configurado:
        motivos.append("El operador debe configurar y comprobar el correo SMTP de Supabase Auth.")
    return {
        "edicion_habilitada": settings.administracion_perfiles_habilitada,
        "invitaciones_habilitadas": not motivos,
        "motivos": motivos,
    }


@router.get("/administracion/configuracion")
def consultar_configuracion_administrativa(_jefe: Usuario = Depends(require_roles("JEFE"))):
    return estado_administracion()


@router.get("/usuarios", response_model=list[MiPerfil])
def listar_usuarios(
    _jefe: Usuario = Depends(require_roles("JEFE")),
    db: Session = Depends(get_db),
):
    return db.scalars(select(Usuario).order_by(Usuario.nombre_completo, Usuario.id)).all()


@router.get("/areas", response_model=list[AreaLectura])
def listar_areas(
    _jefe: Usuario = Depends(require_roles("JEFE")),
    db: Session = Depends(get_db),
):
    return db.scalars(select(Area).order_by(Area.nombre)).all()


def comprobar_escritura():
    if not get_settings().administracion_perfiles_habilitada:
        raise HTTPException(503, "Administración de perfiles deshabilitada. El operador debe validar los permisos PostgreSQL antes de habilitarla.")


def validar_area(db: Session, area_id: UUID):
    area = db.get(Area, area_id)
    if area is None or not area.activo:
        raise HTTPException(422, "Seleccione un área activa existente.")


def bloquear_jefes(db: Session, jefe: Usuario):
    # Orden fijo y bloqueo de jefes: impide deshabilitaciones cruzadas concurrentes.
    jefes = db.scalars(select(Usuario).where(
        Usuario.rol == "JEFE", Usuario.habilitado.is_(True),
    ).order_by(Usuario.id).with_for_update().execution_options(populate_existing=True)).all()
    if not any(usuario.id == jefe.id for usuario in jefes):
        raise HTTPException(403, "La jefatura ya no tiene autorización vigente.")


@router.patch("/usuarios/{usuario_id}", response_model=MiPerfil)
def actualizar_usuario(
    usuario_id: UUID,
    datos: PerfilActualizar,
    jefe: Usuario = Depends(require_roles("JEFE")),
    db: Session = Depends(get_db),
):
    comprobar_escritura()
    bloquear_jefes(db, jefe)
    usuario = db.scalar(select(Usuario).where(Usuario.id == usuario_id).with_for_update())
    if usuario is None:
        raise HTTPException(404, "Usuario no disponible.")
    if usuario_id == jefe.id and (datos.habilitado is False or datos.rol not in (None, "JEFE")):
        raise HTTPException(409, "No puedes deshabilitar tu propio acceso ni retirar tu rol de JEFE.")
    if datos.area_id is not None:
        validar_area(db, datos.area_id)
    try:
        for campo, valor in datos.model_dump(exclude_unset=True).items():
            setattr(usuario, campo, valor)
        db.flush()
        respuesta = MiPerfil.model_validate(usuario)
        db.commit()
        return respuesta
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "El usuario ya existe o los datos no cumplen las reglas del sistema.") from None
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(503, "No se pudo guardar el perfil. Revisa los permisos de administración PostgreSQL.") from None


@router.post("/usuarios/invitar", status_code=201, response_model=MiPerfil)
def invitar_usuario(
    datos: UsuarioInvitar,
    jefe: Usuario = Depends(require_roles("JEFE")),
    db: Session = Depends(get_db),
):
    configuracion = estado_administracion()
    if not configuracion["invitaciones_habilitadas"]:
        raise HTTPException(503, " ".join(configuracion["motivos"]))
    bloquear_jefes(db, jefe)
    validar_area(db, datos.area_id)
    if db.scalar(select(Usuario.id).where(Usuario.usuario == datos.usuario)):
        raise HTTPException(409, "El nombre de usuario ya está registrado.")
    # Auth crea la cuenta y gestiona el correo. Nunca se recibe una contraseña.
    invitado = invitar_en_supabase(datos.correo)
    try:
        identidad = UUID(invitado["id"])
    except (KeyError, ValueError, TypeError):
        raise HTTPException(502, "Supabase no confirmó una identidad válida. Consulta el estado antes de reintentar.") from None
    if db.get(Usuario, identidad) is not None:
        raise HTTPException(409, "La cuenta ya tiene un perfil. Usa la edición de usuarios; no se han cambiado sus permisos.")
    try:
        usuario = Usuario(id=identidad, **datos.model_dump(exclude={"correo"}), habilitado=True)
        db.add(usuario)
        db.flush()
        respuesta = MiPerfil.model_validate(usuario)
        db.commit()
        return respuesta
    except SQLAlchemyError:
        db.rollback()
        # La operación externa no forma parte de la transacción PostgreSQL.
        # La cuenta sin perfil continúa sin acceso por get_current_user.
        raise HTTPException(503, "Supabase aceptó la invitación, pero no se guardó el perfil. La cuenta no tiene acceso nuevo; el operador debe reconciliarla antes de reintentar.") from None
