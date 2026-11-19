"""Reportes institucionales: JEFE en cada consulta y descarga, sin escrituras."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import or_, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth import require_roles
from app.db import get_db
from app.exportaciones_reportes import formatos_disponibles, generar_excel, generar_pdf
from app.models import Area, Asignacion, Incidencia, Usuario
from app.reportes import (ConsultaReporte, ExportarReporte, MAX_BYTES_EXPORTACION, MAX_FILAS_EXPORTACION,
    filtros_solamente, filas_reporte, metadatos, preparar_base, resumen_y_desgloses)

router = APIRouter(prefix="/api/reportes", tags=["Reportes institucionales"])


def lectura_institucional(response: Response, jefe: Usuario = Depends(require_roles("JEFE")), db: Session = Depends(get_db)):
    # La autenticación ya hizo una lectura. Abrir una instantánea propia antes
    # de consultar filtros/totales/filas; no ocupar una segunda conexión del pool.
    id_jefe = jefe.id
    response.headers["Cache-Control"] = "no-store"
    db.rollback()
    try:
        if db.get_bind().dialect.name == "postgresql":
            db.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY"))
        vigente = db.get(Usuario, id_jefe, populate_existing=True)
        if vigente is None or not vigente.habilitado or vigente.rol != "JEFE":
            raise HTTPException(403, "Solo el JEFE habilitado puede consultar reportes institucionales.")
        yield db
    except SQLAlchemyError:
        raise HTTPException(503, "No se pudo consultar el reporte institucional. Intenta nuevamente.") from None
    finally:
        db.rollback()


@router.get("/catalogos")
def catalogos(db: Session = Depends(lectura_institucional)):
    areas = db.scalars(select(Area).order_by(Area.nombre, Area.id)).all()
    responsables = db.scalars(select(Usuario).where(or_(Usuario.rol.in_(["JEFE", "ASISTENTE", "PRACTICANTE"]),
        Usuario.id.in_(select(Asignacion.tecnico_id)),
        Usuario.id.in_(select(Incidencia.cerrado_por_usuario_id).where(Incidencia.cerrado_por_usuario_id.is_not(None)))))
        .order_by(Usuario.nombre_completo, Usuario.id)).all()
    return {"areas": [{"id": a.id, "nombre": a.nombre, "activo": a.activo} for a in areas],
        "responsables": [{"id": u.id, "nombre": u.nombre_completo, "rol": u.rol, "habilitado": u.habilitado} for u in responsables]}


@router.get("/incidencias")
def consultar(consulta: Annotated[ConsultaReporte, Query()], db: Session = Depends(lectura_institucional)):
    filtros = filtros_solamente(consulta)
    datos = metadatos(db, filtros)
    base, ciclo = preparar_base(db, filtros)
    datos.update(resumen_y_desgloses(db, base))
    total = datos["resumen"]["total"]
    datos.update(pagina=consulta.pagina, tamano_pagina=consulta.tamano_pagina,
        total_paginas=(total + consulta.tamano_pagina - 1) // consulta.tamano_pagina,
        incidencias=filas_reporte(db, base, ciclo, limite=consulta.tamano_pagina,
            desplazamiento=(consulta.pagina - 1) * consulta.tamano_pagina),
        exportacion={"maximo_filas": MAX_FILAS_EXPORTACION, "formatos": formatos_disponibles()})
    return datos


@router.get("/incidencias/exportar")
def exportar(consulta: Annotated[ExportarReporte, Query()], db: Session = Depends(lectura_institucional)):
    if consulta.formato not in formatos_disponibles():
        raise HTTPException(503, "El formato solicitado no está disponible en este servidor.")
    filtros = filtros_solamente(consulta)
    datos = metadatos(db, filtros)
    base, ciclo = preparar_base(db, filtros)
    datos.update(resumen_y_desgloses(db, base))
    if datos["resumen"]["total"] > MAX_FILAS_EXPORTACION:
        raise HTTPException(422, f"El reporte supera {MAX_FILAS_EXPORTACION} incidencias. Reduce el período o aplica filtros; no se exportaron datos parciales.")
    datos["incidencias"] = filas_reporte(db, base, ciclo, limite=MAX_FILAS_EXPORTACION)
    try:
        archivo = generar_pdf(datos) if consulta.formato == "pdf" else generar_excel(datos)
    except Exception:
        # No devolver excepciones de librerías, SQL, contenido de filas o rutas privadas.
        raise HTTPException(503, "No se pudo generar el archivo. Reduce el período o intenta nuevamente.") from None
    if len(archivo) > MAX_BYTES_EXPORTACION:
        raise HTTPException(422, "El archivo supera el tamaño seguro de descarga. Reduce el período o aplica filtros; no se exportaron datos parciales.")
    mime = "application/pdf" if consulta.formato == "pdf" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    nombre = f"grocio-prado-incidencias-{datos['fecha_generacion']:%Y%m%d-%H%M%S}.{consulta.formato}"
    return Response(archivo, media_type=mime, headers={"Content-Disposition": f'attachment; filename="{nombre}"',
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})
