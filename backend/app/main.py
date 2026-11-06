
from fastapi import FastAPI

from app.routes.usuarios import router as usuarios_router
from app.routes.incidencias import router as incidencias_router
from app.routes.asignaciones import router as asignaciones_router
from app.routes.intervenciones import router as intervenciones_router


app = FastAPI(
    title="Sistema de Gestión de Incidencias - Soporte TI",
    description=(
        "API del sistema de gestión y seguimiento de "
        "incidencias de la Municipalidad Distrital "
        "de Grocio Prado."
    ),
    version="0.1.0",
)


# Registrar los módulos de nuestra API
app.include_router(usuarios_router)
app.include_router(incidencias_router)
app.include_router(asignaciones_router)
app.include_router(intervenciones_router)


@app.get("/")
def inicio():
    return {
        "sistema": "Soporte TI - Grocio Prado",
        "mensaje": "API iniciada correctamente",
        "version": "0.1.0",
    }


@app.get("/api/health")
def verificar_estado():
    return {
        "estado": "ok",
        "servicio": "backend",
        "base_datos": "pendiente_de_conexion",
    }
