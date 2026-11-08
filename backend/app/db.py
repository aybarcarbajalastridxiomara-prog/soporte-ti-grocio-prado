
from functools import lru_cache
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session

from app.config import get_settings


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    """Prepara la conexión a PostgreSQL."""

    database_url = get_settings().database_url.strip()

    if not database_url:
        raise RuntimeError(
            "DATABASE_URL no está configurada."
        )

    url = make_url(database_url)

    if url.drivername == "postgresql":
        url = url.set(
            drivername="postgresql+psycopg"
        )

    if url.drivername != "postgresql+psycopg":
        raise ValueError(
            "La base de datos debe ser PostgreSQL."
        )

   
    return create_engine(
        url,
        pool_size=1,
        max_overflow=0,
        pool_timeout=10,
        pool_pre_ping=True,
        connect_args={
            "connect_timeout": 10,
            "sslmode": "require",
            "prepare_threshold": None,
        },
    )



def get_db() -> Generator[Session, None, None]:
    """Proporciona una sesión de base de datos."""

    with Session(get_engine()) as session:
        yield session


def verificar_conexion_db() -> bool:
    """Comprueba si PostgreSQL responde."""

    with get_engine().connect() as conexion:
        resultado = conexion.execute(
            text("SELECT 1")
        )
        return resultado.scalar_one() == 1
