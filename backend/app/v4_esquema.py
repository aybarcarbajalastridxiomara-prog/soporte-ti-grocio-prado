
"""Comprobacion de compatibilidad del esquema V4.

Solo realiza lecturas de metadatos PostgreSQL.
No modifica tablas, registros ni configuraciones.
No se activa automaticamente al importar el modulo.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session


COLUMNAS_REQUERIDAS_V4 = frozenset({
    ("incidencias", "ciclo_actual"),
    ("asignaciones", "ciclo_atencion"),
    ("intervenciones", "ciclo_atencion"),
    ("verificaciones", "ciclo_atencion"),
    ("evidencias", "ciclo_atencion"),
    ("historial_incidencias", "ciclo_atencion"),
})


def esquema_v4_disponible(db: Session) -> bool:
    """Devuelve True solo si la estructura requerida existe.

    La verificacion no ejecuta migraciones ni escrituras.
    Si PostgreSQL genera un error, este se propaga para
    impedir que el llamador asuma compatibilidad.
    """

    columnas = db.execute(
        text("""
            SELECT
                table_name,
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN (
                  'incidencias',
                  'asignaciones',
                  'intervenciones',
                  'verificaciones',
                  'evidencias',
                  'historial_incidencias'
              )
        """)
    ).mappings().all()

    columnas_validas = {
        (fila["table_name"], fila["column_name"])
        for fila in columnas
        if fila["data_type"] == "integer"
        and fila["is_nullable"] == "NO"
        and fila["column_default"] is not None
    }

    if not COLUMNAS_REQUERIDAS_V4.issubset(columnas_validas):
        return False

    # El indice debe ser unico, valido y corresponder
    # exactamente a incidencia_id y ciclo_atencion.
    indice = db.execute(
        text("""
            SELECT pg_get_indexdef(i.indexrelid)
            FROM pg_index AS i
            JOIN pg_class AS indice
              ON indice.oid = i.indexrelid
            JOIN pg_class AS tabla
              ON tabla.oid = i.indrelid
            JOIN pg_namespace AS esquema
              ON esquema.oid = tabla.relnamespace
            WHERE esquema.nspname = 'public'
              AND tabla.relname = 'verificaciones'
              AND indice.relname =
                  'ux_verificaciones_incidencia_ciclo'
              AND i.indisunique = true
              AND i.indisvalid = true
              AND i.indisready = true
        """)
    ).scalar_one_or_none()

    if indice is None:
        return False

    if "(incidencia_id, ciclo_atencion)" not in indice:
        return False

    # El indice antiguo no debe seguir bloqueando
    # las verificaciones de nuevos ciclos.
    indice_antiguo_ausente = db.execute(
        text("""
            SELECT to_regclass(
                'public.ux_verificaciones_incidencia'
            ) IS NULL
        """)
    ).scalar_one()

    return bool(indice_antiguo_ausente)
