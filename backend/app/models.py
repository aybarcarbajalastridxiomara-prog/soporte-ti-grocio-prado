
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


# TABLA 1: AREAS
class Area(Base):
    __tablename__ = "areas"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    nombre: Mapped[str] = mapped_column(
        String(100), unique=True
    )
    activo: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true")
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
    )


# TABLA 2: USUARIOS
class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("auth.users.id"),
        primary_key=True,
    )
    area_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("areas.id"),
    )
    nombre_completo: Mapped[str] = mapped_column(String(150))
    usuario: Mapped[str] = mapped_column(
        String(80), unique=True
    )
    rol: Mapped[str] = mapped_column(String(30))
    habilitado: Mapped[bool] = mapped_column(
        Boolean, server_default=text("true")
    )
    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
    )


# TABLA 3: INCIDENCIAS
class Incidencia(Base):
    __tablename__ = "incidencias"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    codigo: Mapped[str] = mapped_column(
        String(25), unique=True
    )
    area_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("areas.id")
    )
    reportante_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("usuarios.id")
    )
    asunto: Mapped[str] = mapped_column(String(200))
    descripcion: Mapped[str] = mapped_column(Text)
    categoria: Mapped[str | None] = mapped_column(String(80))
    equipo_sistema_afectado: Mapped[str | None] = mapped_column(
        String(150)
    )
    ubicacion: Mapped[str | None] = mapped_column(String(150))
    impacto: Mapped[str | None] = mapped_column(String(20))
    fecha_inicio_problema: Mapped[date | None] = mapped_column(
        Date
    )
    estado: Mapped[str] = mapped_column(
        String(20), server_default=text("'Pendiente'")
    )
    prioridad: Mapped[str | None] = mapped_column(String(15))
    fecha_registro: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
    )
    fecha_cierre: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    cerrado_por_usuario_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("usuarios.id"),
    )


# TABLA 4: ASIGNACIONES
class Asignacion(Base):
    __tablename__ = "asignaciones"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    incidencia_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("incidencias.id")
    )
    tecnico_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("usuarios.id")
    )
    asignado_por_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("usuarios.id")
    )
    origen_asignacion: Mapped[str] = mapped_column(String(20))
    fecha_asignacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
    )
    fecha_fin: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    motivo_reasignacion: Mapped[str | None] = mapped_column(Text)


# TABLA 5: INTERVENCIONES
class Intervencion(Base):
    __tablename__ = "intervenciones"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    incidencia_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("incidencias.id")
    )
    tecnico_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("usuarios.id")
    )
    diagnostico: Mapped[str] = mapped_column(Text)
    acciones_realizadas: Mapped[str] = mapped_column(Text)
    duracion_minutos: Mapped[int | None] = mapped_column(Integer)
    solucion_aplicada: Mapped[str | None] = mapped_column(Text)
    es_solucion_final: Mapped[bool] = mapped_column(
        Boolean, server_default=text("false")
    )
    fecha_registro: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
    )


# TABLA 6: VERIFICACIONES
class Verificacion(Base):
    __tablename__ = "verificaciones"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    incidencia_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("incidencias.id")
    )
    usuario_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("usuarios.id")
    )
    resultado: Mapped[str] = mapped_column(String(20))
    observaciones: Mapped[str | None] = mapped_column(Text)
    fecha_verificacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
    )


# TABLA 7: EVIDENCIAS
class Evidencia(Base):
    __tablename__ = "evidencias"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    incidencia_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("incidencias.id")
    )
    usuario_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("usuarios.id")
    )
    nombre_archivo: Mapped[str] = mapped_column(String(255))
    tipo_archivo: Mapped[str] = mapped_column(String(100))
    tamano_bytes: Mapped[int] = mapped_column(BigInteger)
    ruta_archivo: Mapped[str] = mapped_column(Text)
    fecha_registro: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
    )


# TABLA 8: HISTORIAL
class HistorialIncidencia(Base):
    __tablename__ = "historial_incidencias"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    incidencia_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("incidencias.id")
    )
    usuario_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("usuarios.id")
    )
    accion: Mapped[str] = mapped_column(String(100))
    descripcion: Mapped[str] = mapped_column(Text)
    fecha_registro: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("now()"),
    )
