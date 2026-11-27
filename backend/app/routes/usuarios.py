
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID
from uuid import uuid4
import hashlib
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field, StrictBool, model_validator
from sqlalchemy import select, text, func
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import get_current_user, require_roles
from app.config import get_settings
from app.db import get_db
from app.models import Area, Asignacion, Usuario, AuditoriaAdministrativa
from app.supabase_admin import (consultar_correo_supabase, invitar_en_supabase,
                               recuperar_en_supabase, identidad_pendiente, retorno_auth_verificado)


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
RolInvitable = Literal["ASISTENTE", "PRACTICANTE", "REPRESENTANTE"]
AREA_INFORMATICA = "Unidad de Racionalización e Informática"


class AreaLectura(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    nombre: str
    activo: bool


class PerfilAdministrado(MiPerfil):
    archivado: bool = False
    correo: str | None = None
    activacion: Literal["ACTIVADA", "PENDIENTE", "DESCONOCIDA"] = "DESCONOCIDA"
    alta_controlada: bool = False


class AccionAdministrativa(BaseModel):
    model_config = ConfigDict(extra="forbid")
    accion: Literal["habilitar", "deshabilitar", "archivar", "restaurar", "restaurar_habilitado", "eliminar", "reenviar"]


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
    usuario: str = Field(min_length=3, max_length=80, pattern=r"^[a-z0-9][a-z0-9_.-]*$")
    area_id: UUID
    rol: RolInvitable
    habilitado: StrictBool = True
    solicitud_id: UUID = Field(default_factory=uuid4)


class AltaPerfilRespuesta(MiPerfil):
    estado_invitacion: Literal["ACEPTADA_POR_AUTH", "PENDIENTE_COMPROBAR"]
    mensaje: str


def estado_administracion() -> dict:
    settings = get_settings()
    motivos = []
    alta_habilitada = (settings.administracion_perfiles_habilitada
        if settings.invitaciones_usuarios_habilitadas is None else settings.invitaciones_usuarios_habilitadas)
    if not alta_habilitada:
        motivos.append("La modificación de perfiles requiere habilitación y permisos PostgreSQL por el operador.")
    if not settings.supabase_url or not settings.supabase_service_role_key:
        motivos.append("Falta la credencial privada de administración de Supabase en el servidor.")
    if not settings.supabase_smtp_configurado:
        motivos.append("El operador debe configurar y comprobar el correo SMTP de Supabase Auth.")
    try:
        retorno_auth_verificado(settings)
    except HTTPException:
        motivos.append("El operador debe verificar FRONTEND_URL y su retorno HTTPS autorizado en Supabase Auth.")
    return {
        "edicion_habilitada": settings.administracion_perfiles_habilitada,
        "invitaciones_habilitadas": not motivos,
        "motivos": motivos,
    }


def permisos_administrativos_verificados(db: Session, *, solo_alta: bool = False) -> bool:
    """Comprobación conservadora de lectura; nunca aplica GRANT ni cambia RLS."""
    if db.get_bind().dialect.name != "postgresql":
        return False
    return bool(db.execute(text("""
        SELECT current_user = 'soporte_ti_api'
          AND NOT (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user)
          AND has_schema_privilege(current_user,'public','USAGE')
          AND has_table_privilege(current_user,'public.usuarios','SELECT')
          AND has_table_privilege(current_user,'public.areas','SELECT')
          AND has_table_privilege(current_user,to_regclass('public.auditoria_administrativa'),'SELECT')
          AND has_table_privilege(current_user,to_regclass('public.auditoria_administrativa'),'INSERT')
          AND has_any_column_privilege(current_user,'public.areas','UPDATE')
          AND has_any_column_privilege(current_user,'public.usuarios','UPDATE')
          AND NOT EXISTS (
            SELECT 1 FROM (VALUES ('id'),('area_id'),('nombre_completo'),('usuario'),('rol'),('habilitado')) c(nombre)
            WHERE NOT has_column_privilege(current_user,'public.usuarios',c.nombre,'INSERT')
          )
          AND (:solo_alta OR NOT EXISTS (
            SELECT 1 FROM (VALUES ('area_id'),('nombre_completo'),('usuario'),('rol'),('habilitado')) c(nombre)
            WHERE NOT has_column_privilege(current_user,'public.usuarios',c.nombre,'UPDATE')
          ))
          AND (SELECT count(*)=2 AND bool_and(relrowsecurity) FROM pg_class
               WHERE oid IN ('public.usuarios'::regclass,'public.areas'::regclass))
          AND EXISTS (
            SELECT 1 FROM pg_trigger t JOIN pg_proc f ON f.oid=t.tgfoid
              JOIN pg_namespace n ON n.oid=f.pronamespace
            WHERE t.tgrelid='public.usuarios'::regclass
              AND t.tgname='trg_validar_cupo_representantes' AND t.tgenabled IN ('O','A')
              AND NOT t.tgisinternal AND NOT f.prosecdef
              AND n.nspname='public' AND f.proname='validar_cupo_representantes'
          )
          AND NOT EXISTS (
            SELECT 1 FROM pg_trigger t WHERE t.tgrelid='public.usuarios'::regclass
              AND NOT t.tgisinternal AND t.tgname<>'trg_validar_cupo_representantes'
          )
          AND NOT EXISTS (
            SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
              AND p.tablename IN ('usuarios','areas') AND p.permissive='RESTRICTIVE'
              AND ('soporte_ti_api'::name=ANY(p.roles) OR 'public'::name=ANY(p.roles))
          )
          AND NOT EXISTS (
            SELECT 1 FROM (VALUES ('usuarios','SELECT'),('usuarios','INSERT'),('usuarios','UPDATE'),('areas','SELECT'),('areas','UPDATE')) req(tabla,operacion)
            WHERE NOT (:solo_alta AND req.tabla='usuarios' AND req.operacion='UPDATE') AND NOT EXISTS (
              SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=req.tabla
                AND p.cmd IN (req.operacion,'ALL') AND 'soporte_ti_api'::name=ANY(p.roles)
                AND p.permissive='PERMISSIVE'
                AND (req.operacion='INSERT' OR p.qual='true')
                AND (req.operacion='SELECT' OR COALESCE(p.with_check,p.qual)='true')
            )
          )
    """), {"solo_alta": solo_alta}).scalar_one())


def permisos_alta_verificados(db: Session) -> bool:
    return permisos_administrativos_verificados(db, solo_alta=True)


def gestion_ampliada_disponible(db: Session) -> bool:
    if db.get_bind().dialect.name != "postgresql":
        return False
    return bool(db.scalar(text("""
        SELECT COALESCE(has_function_privilege(
            to_regprocedure('public.estado_auth_perfiles(uuid)'), 'EXECUTE'), false)
        AND COALESCE(has_function_privilege(
            to_regprocedure('public.eliminar_perfil_sin_historial(uuid,uuid)'), 'EXECUTE'), false)
    """)))


def directorio_auth(db: Session, jefe: Usuario):
    return db.execute(text("SELECT * FROM public.estado_auth_perfiles(:jefe)"), {"jefe": jefe.id}).mappings()


def perfil_archivado(db: Session, usuario_id: UUID) -> bool:
    return bool(db.scalar(text("SELECT archivado FROM public.usuarios WHERE id = :id"), {"id": usuario_id}))


@router.get("/administracion/configuracion")
def consultar_configuracion_administrativa(
    _jefe: Usuario = Depends(require_roles("JEFE")), db: Session = Depends(get_db),
):
    configuracion = estado_administracion()
    verificados = False
    if configuracion["edicion_habilitada"]:
        try:
            verificados = permisos_administrativos_verificados(db)
        except SQLAlchemyError:
            db.rollback()
        if not verificados:
            configuracion["motivos"].append("Los permisos PostgreSQL, RLS y el bloqueo de áreas no están verificados para administrar perfiles.")
    configuracion["permisos_verificados"] = verificados
    configuracion["edicion_habilitada"] = configuracion["edicion_habilitada"] and verificados
    configuracion["invitaciones_habilitadas"] = configuracion["invitaciones_habilitadas"] and verificados
    alta_verificada = False
    if estado_administracion()["invitaciones_habilitadas"]:
        try:
            alta_verificada = permisos_alta_verificados(db)
        except SQLAlchemyError:
            db.rollback()
        if not alta_verificada:
            configuracion["motivos"].append("El alta requiere permisos PostgreSQL, RLS, cupo y auditoría verificados.")
    configuracion["permisos_alta_verificados"] = alta_verificada
    configuracion["invitaciones_habilitadas"] = estado_administracion()["invitaciones_habilitadas"] and alta_verificada
    configuracion["gestion_ampliada"] = gestion_ampliada_disponible(db)
    return configuracion


@router.get("/usuarios", response_model=list[PerfilAdministrado])
def listar_usuarios(
    jefe: Usuario = Depends(require_roles("JEFE")),
    db: Session = Depends(get_db),
):
    perfiles = [PerfilAdministrado.model_validate(usuario) for usuario in
                db.scalars(select(Usuario).order_by(Usuario.nombre_completo, Usuario.id))]
    if gestion_ampliada_disponible(db):
        auth = {fila["id"]: fila for fila in directorio_auth(db, jefe)}
        archivados = set(db.scalars(text("SELECT id FROM public.usuarios WHERE archivado")))
        for perfil in perfiles:
            perfil.archivado = perfil.id in archivados
            cuenta = auth.get(perfil.id)
            if cuenta:
                perfil.correo = cuenta["correo"]
                if cuenta["activado"]:
                    perfil.activacion = "ACTIVADA"
                elif cuenta["correo"]:
                    perfil.activacion = "PENDIENTE"
    # La auditoría identifica únicamente las altas de este flujo. No presupone
    # confirmación del correo ni habilita eliminación/edición de perfiles.
    if get_settings().supabase_service_role_key:
        try:
            propias = set(db.scalars(select(AuditoriaAdministrativa.usuario_id).where(
                AuditoriaAdministrativa.accion == "INVITAR_PERFIL",
                AuditoriaAdministrativa.nuevo["etapa"].as_string() == "PERFIL_CREADO")))
            for perfil in perfiles:
                perfil.alta_controlada = perfil.id in propias
        except SQLAlchemyError:
            db.rollback()
    return perfiles


@router.get("/usuarios/{usuario_id}/correo")
def consultar_correo_usuario(
    usuario_id: UUID, response: Response,
    _jefe: Usuario = Depends(require_roles("JEFE")), db: Session = Depends(get_db),
) -> dict[str, str | None]:
    if db.get(Usuario, usuario_id) is None:
        raise HTTPException(404, "Usuario no disponible.")
    response.headers["Cache-Control"] = "no-store"
    return {"correo": consultar_correo_supabase(usuario_id)}


@router.get("/areas", response_model=list[AreaLectura])
def listar_areas(
    _jefe: Usuario = Depends(require_roles("JEFE")),
    db: Session = Depends(get_db),
):
    return db.scalars(select(Area).order_by(Area.nombre)).all()


def comprobar_escritura(db: Session):
    if not get_settings().administracion_perfiles_habilitada:
        raise HTTPException(503, "Administración de perfiles deshabilitada. El operador debe validar los permisos PostgreSQL antes de habilitarla.")
    if not permisos_administrativos_verificados(db):
        raise HTTPException(503, "Administración bloqueada: valida permisos, cupo de representantes y auditoría en PostgreSQL.")


def datos_auditables(usuario):
    return {"usuario": usuario.usuario, "rol": usuario.rol, "area_id": str(usuario.area_id), "habilitado": usuario.habilitado}


def comprobar_asignaciones_activas(db: Session, usuario_id: UUID):
    if db.scalar(select(Asignacion.id).where(
        Asignacion.tecnico_id == usuario_id, Asignacion.fecha_fin.is_(None),
    ).limit(1)) is not None:
        raise HTTPException(409, "Reasigna o finaliza las incidencias activas antes de retirar el acceso.")


def bloquear_perfil(db: Session, jefe: Usuario, usuario_id: UUID) -> Usuario:
    bloquear_jefes(db, jefe)
    usuario = db.scalar(select(Usuario).where(Usuario.id == usuario_id).with_for_update())
    if usuario is None:
        raise HTTPException(404, "Usuario no disponible.")
    return usuario


def proteger_jefatura(db: Session, jefe: Usuario, usuario: Usuario):
    if usuario.rol != "JEFE" or not usuario.habilitado or not gestion_ampliada_disponible(db):
        return
    activos = {fila["id"] for fila in directorio_auth(db, jefe) if fila["activado"]}
    restantes = db.scalars(select(Usuario.id).where(
        Usuario.rol == "JEFE", Usuario.habilitado.is_(True), Usuario.id != usuario.id,
    ))
    if not any(identidad in activos for identidad in restantes):
        raise HTTPException(409, "Debe quedar al menos un JEFE habilitado con su cuenta activada.")


@router.get("/administracion/historial")
def historial_administrativo(_jefe: Usuario = Depends(require_roles("JEFE")), db: Session = Depends(get_db), limite: int = Query(50, ge=1, le=100)):
    try:
        return db.scalars(select(AuditoriaAdministrativa).order_by(AuditoriaAdministrativa.fecha_registro.desc(),AuditoriaAdministrativa.id.desc()).limit(limite)).all()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(503, "Historial administrativo pendiente de preparar en este entorno.") from None


def validar_area(db: Session, area_id: UUID) -> Area:
    area = db.get(Area, area_id)
    if area is None or not area.activo:
        raise HTTPException(422, "Seleccione un área activa existente.")
    return area


def validar_cupo_antes_de_invitar(db: Session, datos: UsuarioInvitar):
    if datos.rol != "REPRESENTANTE":
        return
    # Evita crear una identidad externa que ya sabemos que no tendrá cupo.
    db.scalar(select(Area.id).where(Area.id == datos.area_id).with_for_update())
    cantidad = db.scalar(select(func.count()).select_from(Usuario).where(
        Usuario.area_id == datos.area_id, Usuario.rol == "REPRESENTANTE", Usuario.habilitado.is_(True)))
    if cantidad >= 2:
        raise HTTPException(409, "El área ya tiene el cupo autorizado de representantes. No se envió invitación.")


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
    comprobar_escritura(db)
    usuario = bloquear_perfil(db, jefe, usuario_id)
    if usuario_id == jefe.id and (datos.habilitado is False or datos.rol not in (None, "JEFE")):
        raise HTTPException(409, "No puedes deshabilitar tu propio acceso ni retirar tu rol de JEFE.")
    if datos.area_id is not None:
        validar_area(db, datos.area_id)
    if datos.habilitado is True and gestion_ampliada_disponible(db) and perfil_archivado(db, usuario.id):
        raise HTTPException(409, "Restaura primero el perfil archivado.")
    if datos.habilitado is False or datos.rol not in (None, "JEFE"):
        proteger_jefatura(db, jefe, usuario)
    if datos.habilitado is False or (
        usuario.rol in ("ASISTENTE", "PRACTICANTE") and datos.rol in ("JEFE", "REPRESENTANTE")
    ):
        comprobar_asignaciones_activas(db, usuario.id)
    anterior = datos_auditables(usuario)
    try:
        for campo, valor in datos.model_dump(exclude_unset=True).items():
            setattr(usuario, campo, valor)
        db.flush()
        respuesta = MiPerfil.model_validate(usuario)
        db.add(AuditoriaAdministrativa(actor_id=jefe.id, usuario_id=usuario.id, accion="EDITAR_PERFIL", anterior=anterior, nuevo=datos_auditables(usuario)))
        db.commit()
        return respuesta
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "El usuario ya existe o los datos no cumplen las reglas del sistema.") from None
    except SQLAlchemyError as error:
        db.rollback()
        if getattr(getattr(error, "orig", None), "sqlstate", None) == "P0001":
            raise HTTPException(409, "El perfil excede el cupo autorizado de representantes del área.") from None
        raise HTTPException(503, "No se pudo guardar el perfil. Revisa los permisos de administración PostgreSQL.") from None


@router.post("/usuarios/invitar", status_code=201, response_model=AltaPerfilRespuesta)
def invitar_usuario(
    datos: UsuarioInvitar,
    jefe: Usuario = Depends(require_roles("JEFE")),
    db: Session = Depends(get_db),
):
    configuracion = estado_administracion()
    if not configuracion["invitaciones_habilitadas"]:
        raise HTTPException(503, " ".join(configuracion["motivos"]))
    if not permisos_alta_verificados(db):
        raise HTTPException(503, "Alta bloqueada: valida permisos, RLS, cupo y auditoría PostgreSQL.")
    bloquear_jefes(db, jefe)
    contenido = datos.model_dump(mode="json", exclude={"solicitud_id"})
    contenido["correo"] = datos.correo.casefold()
    huella = hashlib.sha256(json.dumps(contenido, sort_keys=True, ensure_ascii=True).encode()).hexdigest()
    reserva = db.get(AuditoriaAdministrativa, datos.solicitud_id)

    def respuesta_perfil(usuario, aceptada=False):
        return AltaPerfilRespuesta(**MiPerfil.model_validate(usuario).model_dump(),
            estado_invitacion="ACEPTADA_POR_AUTH" if aceptada else "PENDIENTE_COMPROBAR",
            mensaje=("Perfil guardado. Auth aceptó la invitación; la recepción y activación deben confirmarse con el destinatario."
                     if aceptada else "Perfil guardado. El envío no está confirmado; comprueba el correo y usa el reenvío controlado del directorio."))

    def respuesta_existente():
        etapas = db.scalars(select(AuditoriaAdministrativa).where(
            AuditoriaAdministrativa.accion == "INVITAR_PERFIL",
            AuditoriaAdministrativa.nuevo["solicitud_id"].as_string() == str(datos.solicitud_id),
        ).order_by(AuditoriaAdministrativa.fecha_registro, AuditoriaAdministrativa.id)).all()
        creada = next((e for e in etapas if e.nuevo.get("etapa") == "PERFIL_CREADO"), None)
        if creada:
            usuario = db.get(Usuario, creada.usuario_id)
            if usuario is None:
                raise HTTPException(409, "El perfil cambió. El operador debe conciliar la solicitud.")
            return respuesta_perfil(usuario, any(e.nuevo.get("etapa") == "ENVIO_ACEPTADO" for e in etapas))
        return None

    if reserva is not None:
        if (reserva.accion != "INVITAR_PERFIL" or reserva.actor_id != jefe.id
                or reserva.nuevo.get("huella") != huella):
            raise HTTPException(409, "La solicitud ya existe con otros datos. No se modificó ningún perfil.")
        existente = respuesta_existente()
        if existente is not None:
            return existente
    area = validar_area(db, datos.area_id)
    if datos.rol in {"ASISTENTE", "PRACTICANTE"} and area.nombre != AREA_INFORMATICA:
        raise HTTPException(422, "Asistentes y practicantes deben pertenecer a la Unidad de Racionalización e Informática.")
    validar_cupo_antes_de_invitar(db, datos)
    if db.scalar(select(Usuario.id).where(func.lower(Usuario.usuario) == datos.usuario).limit(1)):
        raise HTTPException(409, "El nombre de usuario ya está registrado.")
    if gestion_ampliada_disponible(db) and any(
        fila["correo"] and fila["correo"].casefold() == datos.correo.casefold()
        for fila in directorio_auth(db, jefe)
    ):
        raise HTTPException(409, "Ese correo ya tiene un perfil. Usa las acciones del directorio.")
    if reserva is None:
        db.add(AuditoriaAdministrativa(id=datos.solicitud_id, actor_id=jefe.id, usuario_id=jefe.id,
            accion="INVITAR_PERFIL", anterior={}, nuevo={"etapa": "RESERVADA", "huella": huella,
                                                        "solicitud_id": str(datos.solicitud_id)}))
        db.commit()  # Nada se envía antes de disponer de una reserva durable.
        bloquear_jefes(db, jefe)
        # Otro proceso pudo completar ESTA solicitud al liberarse el bloqueo.
        existente = respuesta_existente()
        if existente is not None:
            return existente
        area = validar_area(db, datos.area_id)
        if datos.rol in {"ASISTENTE", "PRACTICANTE"} and area.nombre != AREA_INFORMATICA:
            raise HTTPException(409, "El área cambió. No se creó ninguna identidad.")
        validar_cupo_antes_de_invitar(db, datos)
    datos_correo = {
        "nombre_completo": datos.nombre_completo,
        "usuario": datos.usuario,
        "nombre_area": area.nombre,
        "rol_perfil": datos.rol,
    }
    identidad = identidad_pendiente(datos.correo, datos.solicitud_id, huella, datos_correo=datos_correo)
    if db.get(Usuario, identidad) is not None:
        raise HTTPException(409, "La cuenta ya tiene un perfil. Usa la edición de usuarios; no se han cambiado sus permisos.")
    try:
        usuario = Usuario(id=identidad, **datos.model_dump(exclude={"correo", "solicitud_id"}))
        db.add(usuario)
        db.flush()
        db.add(AuditoriaAdministrativa(actor_id=jefe.id, usuario_id=usuario.id, accion="INVITAR_PERFIL", anterior={},
            nuevo={**datos_auditables(usuario), "etapa": "PERFIL_CREADO", "solicitud_id": str(datos.solicitud_id)}))
        db.add(AuditoriaAdministrativa(actor_id=jefe.id, usuario_id=usuario.id, accion="INVITAR_PERFIL", anterior={},
            nuevo={"etapa": "ENVIO_SOLICITADO", "solicitud_id": str(datos.solicitud_id)}))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(503, "Auth creó una identidad pendiente, sin enviar correo. No se guardó el perfil. Reintenta la misma solicitud para conciliarla sin duplicados.") from None
    aceptada = False
    try:
        invitado = invitar_en_supabase(datos.correo)
        aceptada = UUID(invitado["id"]) == identidad
    except (HTTPException, KeyError, ValueError, TypeError):
        pass  # El perfil ya existe; nunca comunicar un falso fallo de creación.
    try:
        db.add(AuditoriaAdministrativa(actor_id=jefe.id, usuario_id=identidad, accion="INVITAR_PERFIL", anterior={},
            nuevo={"etapa": "ENVIO_ACEPTADO" if aceptada else "ENVIO_NO_CONFIRMADO", "solicitud_id": str(datos.solicitud_id)}))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        aceptada = False  # No repetir automáticamente un correo de resultado incierto.
    return respuesta_perfil(usuario, aceptada)


class ReenvioInvitacion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    solicitud_id: UUID = Field(default_factory=uuid4)


@router.post("/usuarios/{usuario_id}/invitacion/reenviar")
def reenviar_alta_controlada(usuario_id: UUID, datos: ReenvioInvitacion,
        jefe: Usuario = Depends(require_roles("JEFE")), db: Session = Depends(get_db)):
    if not estado_administracion()["invitaciones_habilitadas"] or not permisos_alta_verificados(db):
        raise HTTPException(503, "El reenvío requiere configuración y permisos de alta verificados.")
    usuario = bloquear_perfil(db, jefe, usuario_id)
    if not usuario.habilitado:
        raise HTTPException(409, "El perfil no está habilitado. No se envió ningún correo.")
    creada = db.scalar(select(AuditoriaAdministrativa).where(
        AuditoriaAdministrativa.usuario_id == usuario_id,
        AuditoriaAdministrativa.accion == "INVITAR_PERFIL",
        AuditoriaAdministrativa.nuevo["etapa"].as_string() == "PERFIL_CREADO",
    ).limit(1))
    if creada is None:
        raise HTTPException(409, "La cuenta no procede de este flujo de alta. Usa su procedimiento de acceso existente.")
    reserva = db.get(AuditoriaAdministrativa, datos.solicitud_id)
    if reserva:
        if reserva.actor_id != jefe.id or reserva.usuario_id != usuario_id or reserva.nuevo.get("etapa") != "REENVIO_SOLICITADO":
            raise HTTPException(409, "La solicitud ya está registrada para otra operación.")
        return {"mensaje": "Este reenvío ya fue solicitado. Comprueba su recepción antes de solicitar otro."}
    ahora = datetime.now(timezone.utc)
    intentos = db.scalars(select(AuditoriaAdministrativa.fecha_registro).where(
        AuditoriaAdministrativa.usuario_id == usuario_id,
        AuditoriaAdministrativa.accion == "INVITAR_PERFIL",
        AuditoriaAdministrativa.nuevo["etapa"].as_string().in_(("ENVIO_SOLICITADO", "REENVIO_SOLICITADO")),
        AuditoriaAdministrativa.fecha_registro > ahora - timedelta(hours=1),
    )).all()
    # SQLite de pruebas entrega fechas naive; en PostgreSQL son TIMESTAMPTZ.
    if len(intentos) >= 3 or any(f.replace(tzinfo=f.tzinfo or timezone.utc) > ahora - timedelta(seconds=60) for f in intentos):
        raise HTTPException(429, "Espera 60 segundos entre envíos. Máximo tres por hora.")
    correo = consultar_correo_supabase(usuario_id)
    if not correo:
        raise HTTPException(409, "La identidad no tiene correo disponible.")
    db.add(AuditoriaAdministrativa(id=datos.solicitud_id, actor_id=jefe.id, usuario_id=usuario_id,
        accion="INVITAR_PERFIL", anterior={}, nuevo={"etapa": "REENVIO_SOLICITADO"}))
    db.commit()  # Persistir límite antes de cualquier solicitud externa.
    respuesta = invitar_en_supabase(correo)
    if respuesta.get("id") != str(usuario_id):
        raise HTTPException(502, "Auth no confirmó el reenvío a la identidad esperada.")
    return {"mensaje": "Auth aceptó el reenvío. Confirma la recepción con el destinatario."}


def reenviar_acceso(db: Session, jefe: Usuario, usuario: Usuario) -> dict:
    configuracion = estado_administracion()
    if not configuracion["invitaciones_habilitadas"]:
        raise HTTPException(503, " ".join(configuracion["motivos"]))
    cuenta = next((fila for fila in directorio_auth(db, jefe) if fila["id"] == usuario.id), None)
    if not cuenta or not cuenta["correo"]:
        raise HTTPException(409, "El perfil no tiene un correo de Auth disponible.")
    if cuenta["activado"]:
        raise HTTPException(409, "Este perfil no tiene una invitación pendiente. Actualiza el directorio.")

    ahora = datetime.now(timezone.utc)
    intentos_recientes = select(AuditoriaAdministrativa.id).where(
        AuditoriaAdministrativa.usuario_id == usuario.id,
        AuditoriaAdministrativa.accion.in_(("SOLICITAR_REENVIO", "SOLICITAR_RECUPERACION")),
    )
    limite_horario = db.scalar(select(func.count()).select_from(intentos_recientes.where(
        AuditoriaAdministrativa.fecha_registro > ahora - timedelta(hours=1),
    ).limit(3).subquery()))
    intervalo_minimo = db.scalar(intentos_recientes.where(
        AuditoriaAdministrativa.fecha_registro > ahora - timedelta(seconds=60),
    ).limit(1))
    if limite_horario >= 3 or intervalo_minimo:
        raise HTTPException(429, "Espera al menos 60 segundos entre envíos. Se permiten hasta tres por hora.")
    invitacion_reciente = db.scalar(select(Usuario.id).where(
        Usuario.id == usuario.id, Usuario.fecha_creacion > ahora - timedelta(seconds=60),
    ))
    if invitacion_reciente:
        raise HTTPException(429, "Espera 60 segundos desde la invitación original.")

    usuario_id, jefe_id = usuario.id, jefe.id
    db.add(AuditoriaAdministrativa(
        actor_id=jefe_id, usuario_id=usuario_id,
        accion="SOLICITAR_REENVIO",
        anterior={}, nuevo={},
    ))
    # Reserva persistente incluso ante un error o una respuesta incierta del proveedor.
    db.commit()
    usuario = bloquear_perfil(db, jefe, usuario_id)
    if perfil_archivado(db, usuario.id):
        raise HTTPException(409, "El perfil fue archivado. Actualiza el directorio.")
    vigente = next((fila for fila in directorio_auth(db, jefe) if fila["id"] == usuario_id), None)
    if vigente != cuenta:
        raise HTTPException(409, "El estado de la cuenta cambió. Actualiza el directorio.")

    if cuenta["confirmado"] or not cuenta["invitado"]:
        # Un invitado que abrió el primer enlace puede haber confirmado su correo
        # sin establecer su contraseña. Auth rechaza un nuevo /invite en ese caso.
        recuperar_en_supabase(cuenta["correo"])
    else:
        try:
            respuesta = invitar_en_supabase(cuenta["correo"])
        except HTTPException as fallo:
            if fallo.status_code != 409:
                raise
            # Algunos estados de una cuenta existente rechazan /invite. La
            # recuperación solo se intenta si Auth confirma el mismo correo.
            if consultar_correo_supabase(usuario_id) != cuenta["correo"]:
                raise HTTPException(409, "El correo registrado cambió. Actualiza el directorio.") from None
            recuperar_en_supabase(cuenta["correo"])
        else:
            if respuesta.get("id") != str(usuario_id):
                raise HTTPException(502, "Supabase no confirmó el reenvío para el perfil esperado.")
    return {"mensaje": "Supabase aceptó el envío al correo registrado."}


@router.post("/usuarios/{usuario_id}/acciones")
def administrar_usuario(
    usuario_id: UUID, datos: AccionAdministrativa,
    jefe: Usuario = Depends(require_roles("JEFE")), db: Session = Depends(get_db),
):
    if not gestion_ampliada_disponible(db):
        if datos.accion in ("habilitar", "deshabilitar"):
            habilitado = datos.accion == "habilitar"
            actualizar_usuario(usuario_id, PerfilActualizar(habilitado=habilitado), jefe, db)
            return {"mensaje": "Perfil habilitado." if habilitado else "Perfil deshabilitado."}
        raise HTTPException(503, "Estas acciones requieren la migración de gestión de usuarios.")
    comprobar_escritura(db)
    usuario = bloquear_perfil(db, jefe, usuario_id)
    archivado = perfil_archivado(db, usuario_id)
    accion = datos.accion
    if accion == "reenviar":
        if archivado:
            raise HTTPException(409, "Restaura el perfil antes de enviar un enlace de acceso.")
        return reenviar_acceso(db, jefe, usuario)
    if usuario_id == jefe.id:
        raise HTTPException(409, "No puedes cambiar el acceso ni retirar tu propio perfil.")
    if accion != "eliminar" and archivado != (accion in ("restaurar", "restaurar_habilitado")):
        raise HTTPException(409, "La acción no corresponde al estado del perfil. Actualiza el directorio.")
    if accion in ("habilitar", "deshabilitar") and usuario.habilitado == (accion == "habilitar"):
        raise HTTPException(409, "El perfil ya se encuentra en ese estado.")
    if accion in ("deshabilitar", "archivar", "eliminar"):
        comprobar_asignaciones_activas(db, usuario_id)
        proteger_jefatura(db, jefe, usuario)

    try:
        if accion == "eliminar":
            if not archivado:
                # La función SQL existente exige un perfil archivado. Ambos cambios
                # van en la misma transacción y se revierten si hay dependencias.
                db.execute(text("UPDATE public.usuarios SET archivado = true, habilitado = false WHERE id = :id"),
                           {"id": usuario_id})
            db.execute(text("SELECT public.eliminar_perfil_sin_historial(:jefe, :id)"),
                       {"jefe": jefe.id, "id": usuario_id})
        else:
            anterior = {**datos_auditables(usuario), "archivado": archivado}
            habilitado_nuevo = accion in ("habilitar", "restaurar_habilitado")
            archivado_nuevo = accion == "archivar"
            db.execute(text("UPDATE public.usuarios SET archivado = :archivado, habilitado = :habilitado WHERE id = :id"),
                       {"archivado": archivado_nuevo, "habilitado": habilitado_nuevo, "id": usuario_id})
            db.add(AuditoriaAdministrativa(
                actor_id=jefe.id, usuario_id=usuario_id,
                accion="RESTAURAR_PERFIL" if accion == "restaurar_habilitado" else f"{accion.upper()}_PERFIL",
                anterior=anterior, nuevo={**anterior, "habilitado": habilitado_nuevo, "archivado": archivado_nuevo},
            ))
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        codigo = getattr(getattr(error, "orig", None), "sqlstate", None)
        if accion == "eliminar" and codigo in ("23001", "23503"):
            raise HTTPException(409, "El perfil tiene dependencias históricas. Puedes conservarlo deshabilitado.") from None
        if codigo == "P0001":
            raise HTTPException(409, "El área alcanzó el cupo autorizado de representantes.") from None
        raise HTTPException(503, "No se pudo completar la acción administrativa.") from None
    return {"mensaje": {
        "habilitar": "Perfil habilitado.", "deshabilitar": "Perfil deshabilitado.",
        "archivar": "Perfil archivado.", "restaurar": "Perfil restaurado. Su acceso sigue deshabilitado.",
        "restaurar_habilitado": "Perfil restaurado y habilitado.",
        "eliminar": "Perfil y cuenta eliminados.",
    }[accion]}
