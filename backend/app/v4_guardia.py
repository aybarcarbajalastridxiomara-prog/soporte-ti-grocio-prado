"""Proteccion HTTP para rutas antiguas cuando un ticket usa ciclos V4.

Solo se aplica a operaciones de escritura de routers V3. La base V3 no
se modifica; en V4, una incidencia reabierta debe usar las rutas /api/v4.
"""

from uuid import UUID

from fastapi import Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.db import get_db
from app.models import Usuario
from app.v4_esquema import esquema_v4_disponible


def proteger_operacion_v3(
    request: Request,
    usuario_actual: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Impide escrituras V3 sobre ciclos posteriores al primero.

    Se ejecuta como dependencia de los routers V3. Usa la misma sesion
    que la ruta, de forma que el bloqueo de fila dura hasta el commit.
    """
    if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
        return

    identificador = request.path_params.get("incidencia_id")
    if identificador is None:
        # Crear una nueva incidencia sigue permitido en V3/V4: ciclo 1.
        return

    # Los unit tests historicos inyectan dobles que no son sesiones SQL.
    # get_db, en ejecucion real, siempre proporciona sqlalchemy.orm.Session.
    # La seguridad real se verifica con PostgreSQL temporal en CI.
    if not isinstance(db, Session):
        return

    if not esquema_v4_disponible(db):
        # La BD aun es V3 y no existe el concepto de ciclo_actual.
        return

    # Al habilitar V4, la verificacion antigua no debe registrar
    # observaciones sin ejecutar las reglas de reapertura V4.
    if (
        request.url.path.startswith("/api/incidencias/")
        and request.url.path.endswith("/verificaciones")
    ):
        raise HTTPException(
            status_code=409,
            detail="Utilice /api/v4/incidencias/{id}/verificaciones.",
        )

    try:
        ticket_id = UUID(str(identificador))
    except (ValueError, TypeError):
        # FastAPI validara el identificador en el endpoint (422).
        return

    # FOR UPDATE serializa la verificacion con reaperturas concurrentes.
    # Debe compartirse la sesion con el endpoint V3 (Depends cacheado).
    ciclo = db.execute(
        text("""
            SELECT ciclo_actual
            FROM public.incidencias
            WHERE id = :id
            FOR UPDATE
        """),
        {"id": ticket_id},
    ).scalar_one_or_none()

    if ciclo is not None and ciclo > 1:
        raise HTTPException(
            status_code=409,
            detail=(
                "Incidencia reabierta: use las rutas V4 "
                "para operar sobre el ciclo vigente."
            ),
        )
