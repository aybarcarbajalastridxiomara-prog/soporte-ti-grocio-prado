"""110E: flujo integral V3/V4 con perfiles simulados y PostgreSQL efímero.

Ejecutar únicamente desde GitHub Actions con CI_PG_PORT de la instancia Docker.
No utiliza credenciales ni bases reales. Comprueba APIs, no navegador/UI.
"""
import os
from types import SimpleNamespace
from uuid import UUID

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.main import app
from app.auth import get_current_user
from app.db import get_db

A = UUID("11111111-1111-4111-8111-111111111111")
B = UUID("99999999-9999-4999-8999-999999999999")
REP = UUID("22222222-2222-4222-8222-222222222222")
JEFE = UUID("33333333-3333-4333-8333-333333333333")
TEC1 = UUID("44444444-4444-4444-8444-444444444444")
TEC2 = UUID("55555555-5555-4555-8555-555555555555")
REP_B = UUID("77777777-7777-4777-8777-777777777777")

puerto = os.environ["CI_PG_PORT"]
engine = create_engine(
    f"postgresql+psycopg://soporte_ti_api:api_ci_temporal@127.0.0.1:{puerto}/grocio_ci",
    pool_pre_ping=True,
)
actual = {"id": REP, "rol": "REPRESENTANTE", "area_id": A}


def identidad():
    return SimpleNamespace(**actual)


def sesion_db():
    with Session(engine) as db:
        yield db


app.dependency_overrides[get_current_user] = identidad
app.dependency_overrides[get_db] = sesion_db
cliente = TestClient(app, raise_server_exceptions=False)
contador = 0


def perfil(id_, rol, area=A):
    actual.update(id=id_, rol=rol, area_id=area)


def verificar(respuesta, esperado, etiqueta):
    global contador
    assert respuesta.status_code == esperado, (
        f"{etiqueta}: esperado HTTP {esperado}; obtenido "
        f"{respuesta.status_code}. {respuesta.text[:750]}"
    )
    contador += 1
    print(f"OK {contador:02d} - {etiqueta}", flush=True)
    return respuesta.json()


def registros(sql, **datos):
    with engine.connect() as con:
        return con.execute(text(sql), datos).mappings().all()


def enviar(ruta, datos):
    return cliente.post(ruta, json=datos)


try:
    # PostgreSQL temporal ya tiene V4 instalada: el ciclo inicial utiliza V3.
    perfil(JEFE, "JEFE")
    verificar(cliente.get("/api/tecnicos"), 200, "El jefe consulta técnicos habilitados")
    verificar(
        enviar("/api/incidencias", {"asunto": "No permitido", "descripcion": "Prueba"}),
        403, "El jefe no puede crear tickets del área",
    )

    perfil(REP_B, "REPRESENTANTE", B)
    verificar(cliente.get("/api/tecnicos"), 403, "Representante ajeno no consulta técnicos")

    perfil(REP, "REPRESENTANTE")
    creado = verificar(
        enviar("/api/incidencias", {
            "asunto": "Impresora de Tesorería no funciona",
            "descripcion": "El equipo no permite imprimir documentos.",
            "categoria": "Hardware",
            "equipo_sistema_afectado": "Impresora de Tesorería",
            "ubicacion": "Tesorería",
            "impacto": "Parcialmente",
        }),
        201, "Representante crea ticket V3 real",
    )
    ticket = UUID(creado["id"])
    assert creado["estado"] == "Pendiente"
    ruta = f"/api/incidencias/{ticket}"
    v4 = f"/api/v4/incidencias/{ticket}"
    assert creado["codigo"]

    verificar(cliente.get(ruta), 200, "Representante consulta el ticket de su área")
    verificar(cliente.get(f"{ruta}/historial"), 200, "Historial disponible desde el inicio")

    perfil(REP_B, "REPRESENTANTE", B)
    verificar(cliente.get(ruta), 404, "No se revelan tickets entre áreas")
    verificar(cliente.get(f"{ruta}/contexto-verificacion"), 404,
              "No se revela el contexto de otro área")

    perfil(REP, "REPRESENTANTE")
    verificar(cliente.get(f"{ruta}/contexto-asignacion"), 403,
              "Representante no puede consultar asignación")
    verificar(enviar(f"/api/asignaciones/{ticket}/asignar", {"tecnico_id": str(TEC1)}),
              403, "Representante no puede asignar un técnico")

    perfil(JEFE, "JEFE")
    tecnicos = verificar(cliente.get("/api/tecnicos"), 200, "Jefe consulta catálogo de técnicos")
    assert {x["id"] for x in tecnicos} == {str(TEC1), str(TEC2)}
    contexto = verificar(cliente.get(f"{ruta}/contexto-asignacion"), 200,
                        "Contexto inicial V3 para jefe")
    assert contexto["ciclo_actual"] == 1 and contexto["esquema_v4"] is True
    assert contexto["puede_asignar"] and contexto["tecnico_activo"] is None
    assert contexto["ruta_asignacion"] == f"/api/asignaciones/{ticket}/asignar"
    verificar(enviar(contexto["ruta_asignacion"], {"tecnico_id": str(TEC1)}),
              201, "Jefe asigna técnico al ciclo 1 por V3")
    verificar(enviar(contexto["ruta_asignacion"], {"tecnico_id": str(TEC2)}),
              409, "No permite asignación duplicada")

    perfil(TEC2, "PRACTICANTE")
    verificar(cliente.get(f"{ruta}/contexto-atencion"), 200,
              "Técnico no titular puede consultar contexto")
    verificar(enviar(f"{ruta}/intervenciones", {
        "diagnostico": "Diagnóstico ajeno", "acciones_realizadas": "Sin autorización"
    }), 403, "Técnico no asignado no puede intervenir")

    perfil(TEC1, "ASISTENTE")
    atencion = verificar(cliente.get(f"{ruta}/contexto-atencion"), 200,
                         "Técnico titular consulta permisos del ciclo 1")
    assert atencion["ciclo_actual"] == 1 and atencion["es_responsable"]
    assert atencion["puede_intervenir"] and not atencion["puede_cerrar"]
    assert atencion["ruta_intervencion"] == f"{ruta}/intervenciones"
    verificar(enviar(f"{ruta}/cerrar", {"resumen_cierre":
        "Se comprobó el equipo antes de registrar una solución final."}),
        409, "No se puede cerrar sin solución final")
    verificar(enviar(f"{ruta}/intervenciones", {
        "diagnostico": "Fallo de conexión", "acciones_realizadas": "Revisión de cableado",
        "es_solucion_final": False,
    }), 201, "Técnico registra diagnóstico preliminar V3")
    verificar(enviar(f"{ruta}/intervenciones", {
        "diagnostico": "Conexión intermitente", "acciones_realizadas": "Cambio del cable de datos",
        "solucion_aplicada": "Cable reemplazado", "es_solucion_final": True,
    }), 201, "Técnico registra solución final V3")
    habilitado = verificar(cliente.get(f"{ruta}/contexto-atencion"), 200,
                          "Contexto habilita cierre V3")
    assert habilitado["puede_cerrar"] and habilitado["tiene_solucion_final"]
    verificar(enviar(f"{ruta}/cerrar", {"resumen_cierre":
        "Se cambió el cable de comunicación y se comprobó la impresión."}),
        200, "Técnico cierra primer ciclo")
    verificar(enviar(f"{ruta}/cerrar", {"resumen_cierre":
        "No debe permitirse cerrar nuevamente una incidencia finalizada."}),
        409, "Cierre V3 duplicado rechazado")

    perfil(REP, "REPRESENTANTE")
    contexto = verificar(cliente.get(f"{ruta}/contexto-verificacion"), 200,
                        "Representante ve cierre pendiente de verificación")
    assert contexto["esquema_v4"] and contexto["ciclo_actual"] == 1
    assert contexto["ruta_verificacion"] == f"{v4}/verificaciones"
    assert contexto["puede_verificar"] and contexto["evaluacion_actual"] is None
    verificar(enviar(f"{ruta}/verificaciones", {"resultado": "Conformidad"}),
        409, "Ruta V3 de verificación bloqueada tras migración")
    observacion = verificar(enviar(contexto["ruta_verificacion"], {
        "resultado": "Observación",
        "observaciones": "La impresora continúa fallando después de la reparación.",
    }), 201, "Representante observa y reabre la incidencia")
    assert observacion["ciclo_evaluado"] == 1
    assert observacion["ciclo_actual"] == 2
    assert observacion["estado_actual"] == "En revisión"

    contexto = verificar(cliente.get(f"{ruta}/contexto-verificacion"), 200,
                        "Nuevo ciclo no admite verificación antes del cierre")
    assert contexto["ciclo_actual"] == 2 and not contexto["puede_verificar"]
    verificar(enviar(f"{v4}/verificaciones", {"resultado": "Conformidad"}),
              409, "No se verifica un ciclo reabierto sin cerrar")

    perfil(JEFE, "JEFE")
    contexto = verificar(cliente.get(f"{ruta}/contexto-asignacion"), 200,
                        "Contexto identifica reapertura V4")
    assert contexto["ciclo_actual"] == 2 and contexto["puede_asignar"]
    assert contexto["ruta_asignacion"] == f"{v4}/asignar"
    verificar(enviar(f"/api/asignaciones/{ticket}/asignar", {"tecnico_id": str(TEC2)}),
              409, "No se permite asignar ciclo 2 por V3")
    verificar(enviar(contexto["ruta_asignacion"], {"tecnico_id": str(TEC2)}),
              201, "Jefe asigna nuevo técnico al ciclo 2")

    perfil(TEC1, "ASISTENTE")
    verificar(enviar(f"{v4}/intervenciones", {
        "diagnostico": "Ajeno", "acciones_realizadas": "Intento de intervenir",
    }), 403, "Técnico del ciclo anterior no puede intervenir V4")

    perfil(TEC2, "PRACTICANTE")
    contexto = verificar(cliente.get(f"{ruta}/contexto-atencion"), 200,
                        "Técnico asignado ve ruta V4")
    assert contexto["ciclo_actual"] == 2 and contexto["es_responsable"]
    assert contexto["ruta_intervencion"] == f"{v4}/intervenciones"
    assert not contexto["puede_cerrar"]
    verificar(enviar(f"{v4}/cerrar", {"resumen_cierre":
        "El equipo quedó operando correctamente tras la reparación."}),
        409, "V4 no cierra con solución antigua del primer ciclo")
    verificar(enviar(contexto["ruta_intervencion"], {
        "diagnostico": "Tarjeta de red averiada",
        "acciones_realizadas": "Sustitución de tarjeta y configuración",
        "solucion_aplicada": "Tarjeta instalada y pruebas realizadas",
        "es_solucion_final": True,
        "duracion_minutos": 35,
    }), 201, "Técnico registra solución final V4")
    contexto = verificar(cliente.get(f"{ruta}/contexto-atencion"), 200,
                        "Contexto habilita cierre del segundo ciclo")
    assert contexto["puede_cerrar"] and contexto["tiene_solucion_final"]
    cierre = verificar(enviar(contexto["ruta_cierre"], {"resumen_cierre":
        "Se sustituyó la tarjeta de red y se imprimió correctamente."}),
        200, "Técnico cierra el segundo ciclo")
    assert cierre["ciclo_atencion"] == 2

    perfil(REP, "REPRESENTANTE")
    contexto = verificar(cliente.get(f"{ruta}/contexto-verificacion"), 200,
                        "Representante puede verificar el cierre del ciclo 2")
    assert contexto["ciclo_actual"] == 2 and contexto["puede_verificar"]
    conforme = verificar(enviar(contexto["ruta_verificacion"], {
        "resultado": "Conformidad", "observaciones": "Reparación verificada correctamente."
    }), 201, "Representante registra conformidad final")
    assert conforme["ciclo_actual"] == 2 and conforme["estado_actual"] == "Cerrado"
    verificar(enviar(contexto["ruta_verificacion"], {"resultado": "Conformidad"}),
              409, "No se registra conformidad duplicada")

    # Las consultas de lectura mantienen la historia y los ciclos originales.
    historial = verificar(cliente.get(f"{ruta}/historial"), 200,
                         "Representante consulta historial completo")
    assert any(x["accion"] == "REAPERTURA" for x in historial)
    verificaciones = verificar(cliente.get(f"{ruta}/verificaciones"), 200,
                              "Representante consulta ambas evaluaciones")
    assert [x["resultado"] for x in verificaciones] == ["Conformidad", "Observación"]
    atenciones = verificar(cliente.get(f"{v4}/intervenciones"), 200,
                          "Representante consulta intervenciones de todos los ciclos")
    assert [x["ciclo_atencion"] for x in atenciones] == [1, 1, 2]

    ciclos = registros("""
        SELECT ciclo_actual, estado FROM public.incidencias WHERE id=:id
    """, id=ticket)
    assert ciclos[0]["ciclo_actual"] == 2 and ciclos[0]["estado"] == "Cerrado"
    asignaciones = registros("""
        SELECT ciclo_atencion, tecnico_id, fecha_fin
        FROM public.asignaciones WHERE incidencia_id=:id
        ORDER BY ciclo_atencion
    """, id=ticket)
    assert [(x["ciclo_atencion"], x["tecnico_id"]) for x in asignaciones] == [
        (1, TEC1), (2, TEC2)
    ]
    assert all(x["fecha_fin"] is not None for x in asignaciones)
    print(f"PASO 110E APROBADO: {contador} comprobaciones en PostgreSQL temporal", flush=True)
finally:
    app.dependency_overrides.clear()
    engine.dispose()
