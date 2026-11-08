
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings


from app.routes.usuarios import router as usuarios_router
from app.routes.incidencias import router as incidencias_router
from app.routes.asignaciones import router as asignaciones_router
from app.routes.intervenciones import router as intervenciones_router
from app.routes.informes import router as informes_router
from app.routes.verificaciones import router as verificaciones_router
from app.routes.seguimiento import router as seguimiento_router


app = FastAPI(
    title="Sistema de Gestión de Incidencias - Soporte TI",
    description=(
        "API del sistema de gestión y seguimiento de "
        "incidencias de la Municipalidad Distrital "
        "de Grocio Prado."
    ),
    version="0.1.0",
)

# Permitir solicitudes solo desde el frontend autorizado.
frontend_url = get_settings().frontend_url.strip().rstrip("/")

app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        [frontend_url] if frontend_url else []
    ),
    allow_credentials=False,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
)



# Registrar los módulos de nuestra API
app.include_router(usuarios_router)
app.include_router(incidencias_router)
app.include_router(asignaciones_router)
app.include_router(intervenciones_router)
app.include_router(informes_router)
app.include_router(verificaciones_router)
app.include_router(seguimiento_router)


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
