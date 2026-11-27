"""Paso 110F: comprobaciones seguras sin servicios externos ni BD real.

Ejecutar desde la raiz del repositorio:
    PYTHONPATH=backend python .github/scripts/preentrega_110f.py
Este script NO requiere credenciales, NO ejecuta migraciones ni escribe datos.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(RAIZ / "backend"))

# Asegurar una validacion totalmente aislada sin secretos ni DB.
os.environ["DATABASE_URL"] = ""
os.environ["SUPABASE_URL"] = ""
os.environ["FRONTEND_URL"] = "http://localhost:5173"
os.environ["APP_ENV"] = "ci"

contador = 0

def ok(condicion: bool, descripcion: str) -> None:
    global contador
    if not condicion:
        raise AssertionError(f"FALLO 110F: {descripcion}")
    contador += 1
    print(f"OK {contador:02d}: {descripcion}", flush=True)

def texto(ruta: str) -> str:
    return (RAIZ / ruta).read_text(encoding="utf-8")

# Comprobar contratos de codigo sin exponer las variables reales de Vercel.
entrada = texto("frontend/src/main.tsx")
api = texto("frontend/src/api.ts")
app_real = texto("frontend/src/RealApp.tsx")
detalle = texto("frontend/src/RealTicketDetail.tsx")

auto_switch = 'import.meta.env.VITE_MODO_REAL === "true"'
ok(auto_switch in entrada, "El modo real requiere activacion explicita")
ok('VITE_API_BASE_URL' in api and 'VITE_SUPABASE_URL' in api and
   'VITE_SUPABASE_ANON_KEY' in api, "Variables publicas de cliente definidas")
ok('solicitarAPI' in api and 'Authorization' in api,
   "Las consultas autenticadas usan el cliente API comun")
ok('RealTicketDetail' in app_real and 'rol={perfil.rol}' in app_real,
   "Detalle y rol se transmiten desde RealApp")
ok(all(mod in detalle for mod in ('RealAssignment', 'RealTechnicalActions',
                                  'RealVerification')),
   "Formularios de jefe, tecnico y representante integrados")

for ruta, bandera in [
    ("frontend/src/RealAssignment.tsx", "VITE_PERMITIR_ASIGNACION_REAL"),
    ("frontend/src/RealTechnicalActions.tsx", "VITE_PERMITIR_ATENCION_REAL"),
    ("frontend/src/RealVerification.tsx", "VITE_PERMITIR_VERIFICACION_REAL"),
]:
    codigo = texto(ruta)
    ok(f'import.meta.env.{bandera} === "true"' in codigo,
       f"La escritura de {ruta.rsplit('/', 1)[-1]} esta deshabilitada por defecto")

# Comprobar que no se subieron archivos .env privados.
archivos = subprocess.check_output(
    ["git", "ls-files", "-z"], cwd=RAIZ
).decode("utf-8").split("\0")
expuestos = [p for p in archivos if p and any(
    parte == '.env' or parte.startswith('.env.') and parte != '.env.example'
    for parte in Path(p).parts
)]
ok(not expuestos, "Ningun archivo .env privado esta versionado")

# Validar el contrato real FastAPI/OpenAPI sin una base o JWT.
from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

rutas = app.openapi()["paths"]
esperadas = {
    "/api/me": {"get"},
    "/api/incidencias": {"get", "post"},
    "/api/tecnicos": {"get"},
    "/api/incidencias/{incidencia_id}": {"get"},
    "/api/incidencias/{incidencia_id}/historial": {"get"},
    "/api/incidencias/{incidencia_id}/contexto-asignacion": {"get"},
    "/api/incidencias/{incidencia_id}/contexto-atencion": {"get"},
    "/api/incidencias/{incidencia_id}/contexto-verificacion": {"get"},
    "/api/asignaciones/{incidencia_id}/asignar": {"post"},
    "/api/incidencias/{incidencia_id}/intervenciones": {"get", "post"},
    "/api/incidencias/{incidencia_id}/cerrar": {"post"},
    "/api/v4/incidencias/{incidencia_id}/asignar": {"post"},
    "/api/v4/incidencias/{incidencia_id}/intervenciones": {"get", "post"},
    "/api/v4/incidencias/{incidencia_id}/cerrar": {"post"},
    "/api/v4/incidencias/{incidencia_id}/verificaciones": {"post"},
}
for ruta, metodos in esperadas.items():
    ok(ruta in rutas and metodos.issubset(rutas[ruta].keys()),
       f"Ruta FastAPI disponible: {ruta} ({', '.join(sorted(metodos))})")

with TestClient(app, raise_server_exceptions=False) as cliente:
    salud = cliente.get("/api/health")
    ok(salud.status_code == 200 and salud.json().get("estado") == "ok" and
       salud.json().get("base_datos") == "no_configurada",
       "Health funciona sin conectarse a una base real")
    perfil = cliente.get("/api/me")
    ok(perfil.status_code == 401,
       "El perfil personal no esta disponible sin autenticacion")
    origen = "http://localhost:5173"
    cors = cliente.options("/api/health", headers={
        "Origin": origen, "Access-Control-Request-Method": "GET"
    })
    ok(cors.status_code == 200 and
       cors.headers.get("access-control-allow-origin") == origen,
       "CORS permite exactamente el origen de pruebas configurado")
    ajeno = cliente.options("/api/health", headers={
        "Origin": "https://sitio-no-autorizado.example",
        "Access-Control-Request-Method": "GET",
    })
    ok(ajeno.status_code == 400 and not ajeno.headers.get("access-control-allow-origin"),
       "CORS rechaza origen ajeno")

print(f"PASO 110F PREENTREGA APROBADO: {contador} comprobaciones. SIN ESCRITURAS.", flush=True)
