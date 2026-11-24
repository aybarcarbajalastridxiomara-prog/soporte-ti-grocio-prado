"""Pruebas API/concurrencia en un clúster NUEVO, local y marcado para QA.

--puerto 55432. No acepta hosts/URLs/credenciales externas ni ejecuta
migraciones. Define fixtures V3/V4 desde CREATE TABLE en bases vacías.
"""
import argparse
import contextvars
import json
import os
import re
import sys
import unittest
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from uuid import UUID, uuid4

os.environ.update(DATABASE_URL="", SUPABASE_URL="", SUPABASE_SERVICE_ROLE_KEY="",
                  PYTHON_DOTENV_DISABLED="1", APP_ENV="ci")
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

import psycopg
from psycopg import sql
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session

from app.auth import get_identity
from app.db import get_db
from app.main import app
from app.v4_esquema import esquema_v4_disponible

PORT = None
ACTOR = contextvars.ContextVar("actor_112c")


def admin(database="postgres"):
    connection = psycopg.connect(host="127.0.0.1", port=PORT, user="qa112c", dbname=database, autocommit=True)
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_setting('grocio.entorno_pruebas', true)")
        if cursor.fetchone()[0] != "112c_aislado":
            connection.close()
            raise RuntimeError("Se rechaza un servidor que no sea el clúster aislado 112C")
    return connection


class FuncionesV3(unittest.TestCase):
    v4 = False

    @classmethod
    def setUpClass(cls):
        cls.database = "pruebas_112c_" + uuid4().hex[:12]
        with admin() as connection:
            for role in ("anon", "authenticated", "soporte_ti_api"):
                with connection.cursor() as cursor:
                    cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role,))
                    if not cursor.fetchone():
                        cursor.execute(sql.SQL("CREATE ROLE {} {}").format(sql.Identifier(role),
                            sql.SQL("LOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT" if role == "soporte_ti_api" else "NOLOGIN")))
            connection.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(cls.database)))
        with admin(cls.database) as connection:
            connection.execute("CREATE SCHEMA auth; CREATE TABLE auth.users(id UUID PRIMARY KEY)")
            source = (ROOT / "database/01_esquema_mvp.sql").read_text(encoding="utf-8-sig")
            if cls.v4:
                # Fixture final de CREATE TABLE, sin ALTER/DROP/migración 03.
                for table in ("incidencias", "asignaciones", "intervenciones", "verificaciones", "evidencias", "historial_incidencias"):
                    field = "ciclo_actual" if table == "incidencias" else "ciclo_atencion"
                    old = f"CREATE TABLE public.{table} ("
                    assert source.count(old) == 1
                    source = source.replace(old, old + f"\n    {field} INTEGER NOT NULL DEFAULT 1 CHECK ({field} >= 1),")
                source, changes = re.subn(r"CREATE UNIQUE INDEX ux_verificaciones_incidencia\s+ON public\.verificaciones\s*\(incidencia_id\);",
                    "CREATE UNIQUE INDEX ux_verificaciones_incidencia_ciclo ON public.verificaciones(incidencia_id, ciclo_atencion);", source)
                assert changes == 1
            connection.execute(source)
            connection.execute((ROOT / "database/02_permisos_backend.sql").read_text(encoding="utf-8-sig"))
        cls.engine = create_engine(f"postgresql+psycopg://soporte_ti_api@127.0.0.1:{PORT}/{cls.database}", pool_size=8)
        with Session(cls.engine) as db:
            assert db.execute(text("SELECT current_user")).scalar_one() == "soporte_ti_api"
            assert esquema_v4_disponible(db) == cls.v4

    @classmethod
    def tearDownClass(cls):
        cls.engine.dispose()
        # Solo el nombre aleatorio creado por esta clase en el clúster marcado.
        assert re.fullmatch(r"pruebas_112c_[a-f0-9]{12}", cls.database)
        with admin() as connection:
            connection.execute(sql.SQL("DROP DATABASE {}").format(sql.Identifier(cls.database)))

    def setUp(self):
        self.area, self.otra_area = uuid4(), uuid4()
        self.ids = {role: uuid4() for role in ("JEFE", "ASISTENTE", "PRACTICANTE", "REPRESENTANTE", "OTRO_ASISTENTE", "OTRO_REP")}
        with admin(self.database) as db:
            db.execute("INSERT INTO public.areas(id,nombre) VALUES (%s,%s),(%s,%s)",
                (self.area, "Área ficticia " + uuid4().hex[:8], self.otra_area, "Otra área ficticia " + uuid4().hex[:8]))
            for role, id_ in self.ids.items():
                perfil = "ASISTENTE" if role == "OTRO_ASISTENTE" else "REPRESENTANTE" if role == "OTRO_REP" else role
                db.execute("INSERT INTO auth.users(id) VALUES (%s)", (id_,))
                db.execute("INSERT INTO public.usuarios(id,area_id,nombre_completo,usuario,rol) VALUES (%s,%s,%s,%s,%s)",
                    (id_, self.otra_area if role == "OTRO_REP" else self.area, "Perfil ficticio " + role, role.lower() + uuid4().hex[:8], perfil))

        def session():
            with Session(self.engine) as db:
                yield db

        app.dependency_overrides[get_db] = session
        app.dependency_overrides[get_identity] = lambda: ACTOR.get()
        self.client = TestClient(app, raise_server_exceptions=False)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()

    def request(self, role, method, url, body=None):
        token = ACTOR.set(self.ids[role])
        try:
            return self.client.request(method, url, **({"json": body} if body is not None else {}))
        finally:
            ACTOR.reset(token)

    def crear(self, impacto="Si"):
        r = self.request("REPRESENTANTE", "POST", "/api/incidencias", {"asunto": "Caso ficticio 112C",
            "descripcion": "Incidencia exclusiva de PostgreSQL aislado", "impacto": impacto})
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()["id"]

    def contexto(self, id_, role="JEFE"):
        r = self.request(role, "GET", f"/api/incidencias/{id_}/contexto-prioridad")
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def prioridad(self, id_, role, valor="Alta", contexto=None, **cambios):
        c = contexto or self.contexto(id_, role)
        body = dict(prioridad=valor, justificacion="Justificación ficticia suficiente", ciclo_actual=c["ciclo_actual"],
            version=c["version"], anterior=c["oficial"])
        body.update(cambios)
        return self.request(role, "POST", f"/api/incidencias/{id_}/prioridad", body)

    def tomar(self, id_, role="ASISTENTE", ciclo=1):
        url = f"/api/v4/incidencias/{id_}/tomar" if ciclo > 1 else f"/api/asignaciones/{id_}/tomar"
        return self.request(role, "POST", url, {"ciclo_actual": ciclo} if ciclo > 1 else None)

    def fila(self, query, **params):
        with self.engine.connect() as db:
            return dict(db.execute(text(query), params).mappings().one())

    def cerrar(self, id_, role="ASISTENTE"):
        self.assertEqual(self.tomar(id_, role).status_code, 201)
        intervencion = self.request(role, "POST", f"/api/incidencias/{id_}/intervenciones", {
            "diagnostico": "Diagnóstico ficticio", "acciones_realizadas": "Corrección local ficticia",
            "duracion_minutos": 10, "solucion_aplicada": "Solución final ficticia", "es_solucion_final": True})
        self.assertEqual(intervencion.status_code, 201, intervencion.text)
        cierre = self.request(role, "POST", f"/api/incidencias/{id_}/cerrar", {"resumen_cierre": "Resumen ficticio de cierre suficientemente detallado"})
        self.assertEqual(cierre.status_code, 200, cierre.text)
        return cierre.json()

    def simultaneas(self, trabajos):
        barrera = Barrier(len(trabajos))

        def ejecutar(trabajo):
            barrera.wait(timeout=10)
            return trabajo()

        with ThreadPoolExecutor(max_workers=len(trabajos)) as executor:
            respuestas = list(executor.map(ejecutar, trabajos))
        self.assertEqual(sorted(r.status_code for r in respuestas), [201, 409], [r.text for r in respuestas])
        return respuestas

    def test_sugerencias_no_establecen_prioridad(self):
        for impacto, esperada in (("Si", "Alta"), ("Parcialmente", "Media"), ("No", "Baja"), (None, None)):
            id_ = self.crear(impacto)
            c = self.contexto(id_)
            self.assertEqual(c["sugerida"], esperada)
            self.assertIsNone(c["oficial"])
            self.assertIsNone(c["provisional"])
            self.assertIsNone(c["version"])

    def test_jefe_confirma_modifica_y_rechaza_version_o_ciclo_obsoleto(self):
        id_ = self.crear()
        anterior = self.contexto(id_)
        r = self.prioridad(id_, "JEFE", "Media", anterior)
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(r.json()["oficial"], "Media")
        self.assertEqual(r.json()["actor_id"], str(self.ids["JEFE"]))
        self.assertTrue(r.json()["fecha"])
        self.assertEqual(self.prioridad(id_, "JEFE", "Baja", anterior).status_code, 409)
        self.assertEqual(self.prioridad(id_, "JEFE", ciclo_actual=999).status_code, 409)
        actual = self.contexto(id_)
        self.assertEqual(self.prioridad(id_, "JEFE", "Baja", actual).status_code, 201)
        row = self.fila("SELECT descripcion,usuario_id FROM public.historial_incidencias WHERE incidencia_id=:id AND accion='PRIORIDAD_CONFIRMADA' ORDER BY fecha_registro DESC LIMIT 1", id=UUID(id_))
        datos = json.loads(row["descripcion"])
        self.assertEqual((datos["anterior"], datos["nueva"], datos["ciclo"]), ("Media", "Baja", 1))
        self.assertEqual(row["usuario_id"], self.ids["JEFE"])

    def test_provisional_no_es_oficial_y_solo_jefe_la_revisa(self):
        id_ = self.crear("Parcialmente")
        self.assertEqual(self.tomar(id_).status_code, 201)
        r = self.prioridad(id_, "ASISTENTE")
        self.assertEqual(r.status_code, 201, r.text)
        self.assertIsNone(r.json()["oficial"])
        self.assertEqual(r.json()["provisional"], "Alta")
        self.assertTrue(r.json()["revision_pendiente"])
        self.assertFalse(r.json()["puede_establecer"])
        listado = self.request("JEFE", "GET", "/api/incidencias").json()
        fila = next(t for t in listado if t["id"] == id_)
        self.assertIsNone(fila["prioridad"])
        self.assertEqual(fila["prioridad_provisional"], "Alta")
        self.assertEqual(self.prioridad(id_, "ASISTENTE", "Baja").status_code, 403)
        revision = self.prioridad(id_, "JEFE", "Media")
        self.assertEqual(revision.status_code, 201, revision.text)
        self.assertEqual(revision.json()["oficial"], "Media")
        self.assertFalse(revision.json()["revision_pendiente"])
        self.assertIsNone(revision.json()["provisional"])
        self.assertEqual(self.prioridad(id_, "ASISTENTE").status_code, 403)

    def test_validaciones_y_permisos_de_prioridad(self):
        id_ = self.crear()
        for role in ("REPRESENTANTE", "PRACTICANTE", "ASISTENTE", "OTRO_ASISTENTE"):
            self.assertEqual(self.prioridad(id_, role).status_code, 403)
        for cambios in ({"justificacion": "   "}, {"justificacion": "x" * 1001}, {"prioridad": "Urgente"}, {"actor_id": str(self.ids["JEFE"])}, {"provisional": False}):
            self.assertEqual(self.prioridad(id_, "JEFE", **cambios).status_code, 422)
        self.assertEqual(self.request("OTRO_REP", "GET", f"/api/incidencias/{id_}/contexto-prioridad").status_code, 404)
        asignacion = self.request("JEFE", "POST", f"/api/asignaciones/{id_}/asignar", {"tecnico_id": str(self.ids["ASISTENTE"])})
        self.assertEqual(asignacion.status_code, 201, asignacion.text)
        self.assertEqual(self.prioridad(id_, "ASISTENTE").status_code, 403)

    def test_toma_y_trabajo_tecnico_se_conservan_reportes_institucionales_solo_jefe(self):
        id_ = self.crear()
        self.cerrar(id_)
        for role in ("ASISTENTE", "PRACTICANTE", "REPRESENTANTE"):
            self.assertEqual(self.request(role, "GET", "/api/reportes/incidencias").status_code, 403)
            self.assertEqual(self.request(role, "GET", f"/api/incidencias/{id_}/informe-tecnico/borrador").status_code,
                200 if role == "ASISTENTE" else 403)
        informe = self.request("JEFE", "GET", f"/api/incidencias/{id_}/informe-tecnico/borrador")
        self.assertEqual(informe.status_code, 200, informe.text)
        self.assertEqual(informe.json()["duracion_total_registrada_minutos"], 10)
        self.assertEqual(self.tomar(id_).status_code, 409)
        self.assertFalse(self.request("PRACTICANTE", "GET", f"/api/incidencias/{id_}/contexto-toma").json()["puede_tomar"])

    def test_jefe_toma_registra_solucion_y_cierra_como_responsable(self):
        cierre = self.cerrar(self.crear(), "JEFE")
        self.assertEqual(cierre["cerrado_por_usuario_id"], str(self.ids["JEFE"]))

    def test_representante_y_deshabilitado_no_pueden_tomar(self):
        id_ = self.crear()
        self.assertEqual(self.tomar(id_, "REPRESENTANTE").status_code, 403)
        self.assertEqual(self.request("REPRESENTANTE", "GET", f"/api/incidencias/{id_}/contexto-toma").status_code, 403)
        with admin(self.database) as db:
            db.execute("UPDATE public.usuarios SET habilitado=false WHERE id=%s", (self.ids["ASISTENTE"],))
        self.assertEqual(self.tomar(id_).status_code, 403)
        self.assertEqual(self.prioridad(id_, "ASISTENTE", contexto=self.contexto(id_)).status_code, 403)

    def test_concurrencia_toma_un_solo_responsable(self):
        id_ = self.crear()
        self.simultaneas([lambda: self.tomar(id_, "ASISTENTE"), lambda: self.tomar(id_, "PRACTICANTE")])
        row = self.fila("SELECT count(*) AS n FROM public.asignaciones WHERE incidencia_id=:id AND fecha_fin IS NULL", id=UUID(id_))
        self.assertEqual(row["n"], 1)
        self.assertEqual(self.fila("SELECT count(*) AS n FROM public.historial_incidencias WHERE incidencia_id=:id AND accion='AUTOTOMA'", id=UUID(id_))["n"], 1)

    def test_concurrencia_prioridad_sin_sobrescritura_silenciosa(self):
        id_ = self.crear()
        self.assertEqual(self.tomar(id_).status_code, 201)
        c = self.contexto(id_, "ASISTENTE")
        self.simultaneas([lambda: self.prioridad(id_, "ASISTENTE", "Alta", c), lambda: self.prioridad(id_, "ASISTENTE", "Media", c)])
        c = self.contexto(id_)
        self.assertIsNone(c["oficial"])
        self.simultaneas([lambda: self.prioridad(id_, "JEFE", "Baja", c), lambda: self.prioridad(id_, "JEFE", "Media", c)])
        self.assertEqual(self.fila("SELECT count(*) AS n FROM public.historial_incidencias WHERE incidencia_id=:id AND accion IN ('PRIORIDAD_PROVISIONAL','PRIORIDAD_CONFIRMADA')", id=UUID(id_))["n"], 2)

    def test_concurrencia_asignacion_jefe_frente_a_autotoma(self):
        id_ = self.crear()
        self.simultaneas([lambda: self.tomar(id_), lambda: self.request("JEFE", "POST", f"/api/asignaciones/{id_}/asignar", {"tecnico_id": str(self.ids["PRACTICANTE"])})])
        self.assertEqual(self.fila("SELECT count(*) AS n FROM public.asignaciones WHERE incidencia_id=:id AND fecha_fin IS NULL", id=UUID(id_))["n"], 1)

    def test_rollback_no_deja_prioridad_sin_historial(self):
        id_ = self.crear()
        c = self.contexto(id_)

        def fallo(conn, cursor, statement, parameters, context, executemany):
            if "INSERT INTO" in statement and "historial_incidencias" in statement:
                raise RuntimeError("Fallo de historial exclusivo de fixture")

        event.listen(self.engine, "before_cursor_execute", fallo)
        try:
            self.assertEqual(self.prioridad(id_, "JEFE", contexto=c).status_code, 500)
        finally:
            event.remove(self.engine, "before_cursor_execute", fallo)
        self.assertIsNone(self.contexto(id_)["oficial"])
        self.assertIsNone(self.contexto(id_)["version"])


class FuncionesV4(FuncionesV3):
    v4 = True

    def reabierta(self):
        id_ = self.crear()
        cierre = self.cerrar(id_)
        r = self.request("REPRESENTANTE", "POST", f"/api/v4/incidencias/{id_}/verificaciones",
            {"resultado": "Observación", "observaciones": "Persiste el problema ficticio"})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual((r.json()["estado_actual"], r.json()["ciclo_actual"]), ("En revisión", 2))
        return id_, cierre

    def cerrar_ciclo2(self, id_, role):
        r = self.request(role, "POST", f"/api/v4/incidencias/{id_}/intervenciones", {
            "diagnostico": "Diagnóstico del nuevo ciclo", "acciones_realizadas": "Acciones del nuevo ciclo",
            "solucion_aplicada": "Solución nueva del ciclo actual", "es_solucion_final": True})
        self.assertEqual(r.status_code, 201, r.text)
        r = self.request(role, "POST", f"/api/v4/incidencias/{id_}/cerrar", {"resumen_cierre": "Cierre ficticio justificado del segundo ciclo"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["cerrado_por_usuario_id"], str(self.ids[role]))
        self.assertEqual(r.json()["ciclo_atencion"], 2)

    def test_autotoma_de_ciclo_reabierto_conserva_historia_y_provisional(self):
        id_, cierre = self.reabierta()
        self.assertEqual(self.tomar(id_).status_code, 409)
        c = self.request("ASISTENTE", "GET", f"/api/incidencias/{id_}/contexto-toma").json()
        self.assertTrue(c["puede_tomar"])
        self.assertEqual(c["ciclo_actual"], 2)
        self.assertEqual(self.tomar(id_, ciclo=3).status_code, 409)
        toma = self.tomar(id_, ciclo=2)
        self.assertEqual(toma.status_code, 201, toma.text)
        self.assertEqual(self.prioridad(id_, "ASISTENTE").status_code, 201)
        row = self.fila("SELECT ciclo_atencion,origen_asignacion,tecnico_id FROM public.asignaciones WHERE incidencia_id=:id AND fecha_fin IS NULL", id=UUID(id_))
        self.assertEqual((row["ciclo_atencion"], row["origen_asignacion"], row["tecnico_id"]), (2, "AUTOTOMA", self.ids["ASISTENTE"]))
        self.assertEqual(self.fila("SELECT count(*) AS n FROM public.historial_incidencias WHERE incidencia_id=:id AND accion='CIERRE' AND ciclo_atencion=1", id=UUID(id_))["n"], 1)
        self.assertEqual(self.fila("SELECT count(*) AS n FROM public.historial_incidencias WHERE incidencia_id=:id AND accion='PRIORIDAD_PROVISIONAL' AND ciclo_atencion=2", id=UUID(id_))["n"], 1)
        self.cerrar_ciclo2(id_, "ASISTENTE")
        self.assertEqual(self.fila("SELECT count(*) AS n FROM public.historial_incidencias WHERE incidencia_id=:id AND accion='CIERRE'", id=UUID(id_))["n"], 2)

    def test_jefe_toma_y_atiende_ciclo_reabierto(self):
        id_, _ = self.reabierta()
        self.assertEqual(self.tomar(id_, "JEFE", 2).status_code, 201)
        self.cerrar_ciclo2(id_, "JEFE")

    def test_concurrencia_autotoma_v4_y_jefe_puede_atender(self):
        id_, _ = self.reabierta()
        self.simultaneas([lambda: self.tomar(id_, "JEFE", 2), lambda: self.tomar(id_, "ASISTENTE", 2)])
        self.assertEqual(self.fila("SELECT count(*) AS n FROM public.asignaciones WHERE incidencia_id=:id AND fecha_fin IS NULL AND ciclo_atencion=2", id=UUID(id_))["n"], 1)

    def test_concurrencia_asignacion_v4_frente_a_autotoma(self):
        id_, _ = self.reabierta()
        self.simultaneas([lambda: self.tomar(id_, ciclo=2), lambda: self.request("JEFE", "POST", f"/api/v4/incidencias/{id_}/asignar", {"tecnico_id": str(self.ids["PRACTICANTE"])})])
        self.assertEqual(self.fila("SELECT count(*) AS n FROM public.asignaciones WHERE incidencia_id=:id AND fecha_fin IS NULL", id=UUID(id_))["n"], 1)

    def test_regresion_reapertura_actual_no_fue_modificada(self):
        id_, cierre = self.reabierta()
        row = self.fila("SELECT estado,ciclo_actual,fecha_cierre,cerrado_por_usuario_id FROM public.incidencias WHERE id=:id", id=UUID(id_))
        self.assertEqual((row["estado"], row["ciclo_actual"]), ("En revisión", 2))
        self.assertIsNone(row["fecha_cierre"])
        self.assertIsNone(row["cerrado_por_usuario_id"])
        anterior = self.fila("SELECT tecnico_id,fecha_fin FROM public.asignaciones WHERE incidencia_id=:id AND ciclo_atencion=1", id=UUID(id_))
        self.assertEqual(anterior["tecnico_id"], self.ids["ASISTENTE"])
        self.assertEqual(anterior["fecha_fin"], datetime.fromisoformat(cierre["fecha_cierre"].replace("Z", "+00:00")))
        self.assertEqual(self.fila("SELECT count(*) AS n FROM public.historial_incidencias WHERE incidencia_id=:id AND accion IN ('CIERRE','OBSERVACION','REAPERTURA')", id=UUID(id_))["n"], 3)

    def test_legado_sin_evento_cierre_conserva_datos_originales_al_reabrir(self):
        id_ = self.crear()
        with admin(self.database) as db:
            db.execute("UPDATE public.incidencias SET estado='Cerrado',fecha_cierre=now(),cerrado_por_usuario_id=%s WHERE id=%s",
                (self.ids["ASISTENTE"], UUID(id_)))
        anterior = self.fila("SELECT fecha_cierre,cerrado_por_usuario_id FROM public.incidencias WHERE id=:id", id=UUID(id_))
        r = self.request("REPRESENTANTE", "POST", f"/api/v4/incidencias/{id_}/verificaciones",
            {"resultado": "Observación", "observaciones": "Caso legado ficticio sin historia completa"})
        self.assertEqual(r.status_code, 201, r.text)
        # Se conserva la reapertura automática, sin fabricar un CIERRE retroactivo.
        self.assertIsNone(self.fila("SELECT fecha_cierre FROM public.incidencias WHERE id=:id", id=UUID(id_))["fecha_cierre"])
        self.assertEqual(self.fila("SELECT count(*) AS n FROM public.historial_incidencias WHERE incidencia_id=:id AND accion='CIERRE'", id=UUID(id_))["n"], 0)
        copia = self.fila("SELECT usuario_id,descripcion,ciclo_atencion FROM public.historial_incidencias WHERE incidencia_id=:id AND accion='CIERRE_PRESERVADO'", id=UUID(id_))
        datos = json.loads(copia["descripcion"])
        self.assertEqual(datetime.fromisoformat(datos["fecha_cierre"]), anterior["fecha_cierre"])
        self.assertEqual(datos["cerrado_por_usuario_id"], str(anterior["cerrado_por_usuario_id"]))
        self.assertEqual(copia["usuario_id"], self.ids["REPRESENTANTE"])
        self.assertEqual(copia["ciclo_atencion"], 1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--puerto", type=int, required=True)
    args = parser.parse_args()
    if not 1024 < args.puerto < 65536:
        raise SystemExit("Puerto local de pruebas no válido")
    PORT = args.puerto
    with admin():
        pass
    suite = unittest.defaultTestLoader.loadTestsFromNames(["FuncionesV3", "FuncionesV4"], sys.modules[__name__])
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(not result.wasSuccessful())
