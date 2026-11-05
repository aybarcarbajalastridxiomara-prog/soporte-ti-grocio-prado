
from fastapi import FastAPI

app = FastAPI(
    title="Sistema de Gestión de Incidencias - Soporte TI",
    description=(
        "API del sistema de gestión y seguimiento de "
        "incidencias de la Municipalidad Distrital "
        "de Grocio Prado."
    ),
    version="0.1.0",
)


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
