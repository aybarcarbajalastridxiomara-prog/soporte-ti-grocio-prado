"""Regresiones 112C; incluye la política institucional ya autorizada.

Solo SQLite en memoria con perfiles ficticios. Sin Supabase, PostgreSQL,
RLS/triggers reales ni pruebas de concurrencia. No carga archivos .env.
"""
import os
import unittest
from datetime import datetime, timezone
from unittest.mock import patch
from uuid import uuid4

os.environ.update(DATABASE_URL="", SUPABASE_URL="", SUPABASE_SERVICE_ROLE_KEY="",
                  PYTHON_DOTENV_DISABLED="1", APP_ENV="ci")

from fastapi.testclient import TestClient
from sqlalchemy import DefaultClause, MetaData, create_engine, event, select, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.auth import get_identity
from app.db import get_db
from app.main import app
from app.models import Area, Asignacion, HistorialIncidencia, Incidencia, Intervencion, Usuario, Verificacion


class Diagnostico112C(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

        @event.listens_for(self.engine, "connect")
        def funciones_locales(connection, _):
            connection.create_function("gen_random_uuid", 0, lambda: uuid4().hex)
            connection.create_function("now", 0, lambda: datetime.now(timezone.utc).isoformat())

        metadata = MetaData()
        for model in (Area, Usuario, Incidencia, Asignacion, Intervencion, Verificacion, HistorialIncidencia):
            table = model.__table__.to_metadata(metadata)
            for constraint in list(table.foreign_key_constraints):
                table.constraints.remove(constraint)
            table.foreign_keys.clear()
            for column in table.columns:
                column.foreign_keys.clear()
                default = getattr(column.server_default, "arg", None)
                column.server_default = DefaultClause(text(f"({default})")) if default is not None else None
        metadata.create_all(self.engine)
        self.area = uuid4()
        self.ids = {role: uuid4() for role in ("JEFE", "ASISTENTE", "PRACTICANTE", "REPRESENTANTE")}
        with Session(self.engine) as db:
            db.add(Area(id=self.area, nombre="Área ficticia 112C", activo=True))
            for role, id_ in self.ids.items():
                db.add(Usuario(id=id_, area_id=self.area, nombre_completo=f"Perfil ficticio {role}",
                    usuario=role.lower(), rol=role, habilitado=True))
            db.commit()
        self.actor = "JEFE"

        def session():
            with Session(self.engine) as db:
                yield db

        app.dependency_overrides[get_db] = session
        app.dependency_overrides[get_identity] = lambda: self.ids[self.actor]
        self.guard = patch("app.v4_guardia.esquema_v4_disponible", return_value=False)
        self.guard.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.guard.stop()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def ticket(self, estado="Pendiente", impacto=None):
        id_ = uuid4()
        cerrado = estado == "Cerrado"
        with Session(self.engine) as db:
            db.add(Incidencia(id=id_, codigo=f"112C-{id_.hex[:10]}", area_id=self.area,
                reportante_id=self.ids["REPRESENTANTE"], asunto="Caso ficticio 112C",
                descripcion="Solo memoria local", estado=estado, impacto=impacto, prioridad=None,
                fecha_cierre=datetime(2026, 1, 2, 12, tzinfo=timezone.utc) if cerrado else None,
                cerrado_por_usuario_id=self.ids["ASISTENTE"] if cerrado else None))
            db.commit()
        return id_

    def asignacion(self, id_, role="ASISTENTE", finalizada=False):
        with Session(self.engine) as db:
            db.add(Asignacion(incidencia_id=id_, tecnico_id=self.ids[role], asignado_por_id=self.ids["JEFE"],
                origen_asignacion="JEFATURA",
                fecha_fin=datetime(2026, 1, 2, 12, tzinfo=timezone.utc) if finalizada else None))
            db.commit()

    def intervencion(self, id_):
        with Session(self.engine) as db:
            db.add(Intervencion(incidencia_id=id_, tecnico_id=self.ids["ASISTENTE"],
                diagnostico="Diagnóstico ficticio", acciones_realizadas="Acción ficticia",
                duracion_minutos=10, es_solucion_final=False))
            db.commit()

    def test_borrador_tecnico_conserva_participacion_historica(self):
        id_ = self.ticket("En revisión")
        self.intervencion(id_)
        for role in ("ASISTENTE", "PRACTICANTE"):
            self.asignacion(id_, role, finalizada=True)
        for role in ("JEFE", "ASISTENTE", "PRACTICANTE"):
            self.actor = role
            response = self.client.get(f"/api/incidencias/{id_}/informe-tecnico/borrador")
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["duracion_total_registrada_minutos"], 10)

    def test_borrador_rechaza_tercero_representante_deshabilitado_y_sesion_ausente(self):
        id_ = self.ticket("En revisión")
        self.intervencion(id_)
        self.asignacion(id_)
        for role in ("PRACTICANTE", "REPRESENTANTE"):
            self.actor = role
            self.assertEqual(self.client.get(f"/api/incidencias/{id_}/informe-tecnico/borrador").status_code, 403)
        self.actor = "ASISTENTE"
        with Session(self.engine) as db:
            db.get(Usuario, self.ids[self.actor]).habilitado = False
            db.commit()
        self.assertEqual(self.client.get(f"/api/incidencias/{id_}/informe-tecnico/borrador").status_code, 403)
        app.dependency_overrides.pop(get_identity)
        self.assertEqual(self.client.get(f"/api/incidencias/{id_}/informe-tecnico/borrador").status_code, 401)

    def test_autotoma_actual_por_roles_ti_sin_declarar_ausencia_y_con_historial(self):
        for role in ("JEFE", "ASISTENTE", "PRACTICANTE"):
            with self.subTest(role=role):
                id_ = self.ticket()
                self.actor = role
                response = self.client.post(f"/api/asignaciones/{id_}/tomar")
                self.assertEqual(response.status_code, 201, response.text)
                with Session(self.engine) as db:
                    asignacion = db.scalar(select(Asignacion).where(Asignacion.incidencia_id == id_))
                    evento = db.scalar(select(HistorialIncidencia).where(HistorialIncidencia.incidencia_id == id_))
                    self.assertEqual(asignacion.tecnico_id, self.ids[role])
                    self.assertEqual(asignacion.asignado_por_id, self.ids[role])
                    self.assertEqual(asignacion.origen_asignacion, "AUTOTOMA")
                    self.assertEqual(evento.accion, "AUTOTOMA")
                    self.assertEqual(evento.usuario_id, self.ids[role])
                    self.assertEqual(db.get(Incidencia, id_).estado, "En revisión")
                    self.assertIsNone(db.get(Incidencia, id_).prioridad)

    def test_autotoma_rechaza_representante_cerrada_y_responsable_existente(self):
        libre = self.ticket()
        self.actor = "REPRESENTANTE"
        self.assertEqual(self.client.post(f"/api/asignaciones/{libre}/tomar").status_code, 403)
        self.actor = "ASISTENTE"
        cerrada = self.ticket("Cerrado")
        self.assertEqual(self.client.post(f"/api/asignaciones/{cerrada}/tomar").status_code, 409)
        self.asignacion(libre, "PRACTICANTE")
        self.assertEqual(self.client.post(f"/api/asignaciones/{libre}/tomar").status_code, 409)
        with Session(self.engine) as db:
            self.assertEqual(db.scalar(select(Asignacion).where(Asignacion.incidencia_id == libre)).tecnico_id,
                self.ids["PRACTICANTE"])
            self.assertEqual(db.get(Incidencia, cerrada).estado, "Cerrado")

    def test_autotoma_v3_se_bloquea_en_ciclo_reabierto_sin_crear_asignacion(self):
        id_ = self.ticket("En revisión")
        with self.engine.begin() as db:
            db.execute(text("ALTER TABLE incidencias ADD COLUMN ciclo_actual INTEGER NOT NULL DEFAULT 2"))
        self.actor = "ASISTENTE"
        execute = Session.execute

        def lectura_ciclo_sqlite(db, query, params=None, *args, **kwargs):
            # Solo esta lectura de la guardia usa SQL textual PostgreSQL.
            # Se consulta el mismo ciclo en memoria; no se simulan bloqueos.
            if "SELECT ciclo_actual" in str(query) and "FOR UPDATE" in str(query):
                self.assertEqual(params["id"], id_)
                return execute(db, text("SELECT ciclo_actual FROM incidencias WHERE id = :id"),
                    {"id": id_.hex}, *args, **kwargs)
            return execute(db, query, params, *args, **kwargs)

        with patch("app.v4_guardia.esquema_v4_disponible", return_value=True), \
                patch.object(Session, "execute", lectura_ciclo_sqlite):
            response = self.client.post(f"/api/asignaciones/{id_}/tomar")
        self.assertEqual(response.status_code, 409, response.text)
        self.assertIn("rutas V4", response.json()["detail"])
        with Session(self.engine) as db:
            self.assertIsNone(db.scalar(select(Asignacion).where(Asignacion.incidencia_id == id_)))

    def test_impactos_informados_siguen_sin_prioridad_tras_autotoma(self):
        self.actor = "ASISTENTE"
        for impacto in ("Si", "Parcialmente", "No", None):
            id_ = self.ticket(impacto=impacto)
            self.assertEqual(self.client.post(f"/api/asignaciones/{id_}/tomar").status_code, 201)
            detalle = self.client.get(f"/api/incidencias/{id_}").json()
            self.assertEqual(detalle["impacto"], impacto)
            self.assertIsNone(detalle["prioridad"])

    def test_observacion_v3_conserva_cierre_y_evento_anterior_y_rechaza_duplicado(self):
        id_ = self.ticket("Cerrado")
        with Session(self.engine) as db:
            db.add(HistorialIncidencia(incidencia_id=id_, usuario_id=self.ids["ASISTENTE"],
                accion="CIERRE", descripcion="Cierre ficticio anterior", fecha_registro=datetime(2026, 1, 2, 12)))
            anterior = db.get(Incidencia, id_).fecha_cierre
            db.commit()
        self.actor = "REPRESENTANTE"
        body = {"resultado": "Observación", "observaciones": "El problema ficticio continúa"}
        response = self.client.post(f"/api/incidencias/{id_}/verificaciones", json=body)
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(self.client.post(f"/api/incidencias/{id_}/verificaciones", json=body).status_code, 409)
        with Session(self.engine) as db:
            ticket = db.get(Incidencia, id_)
            self.assertEqual(ticket.estado, "Cerrado")
            self.assertEqual(ticket.fecha_cierre, anterior)
            self.assertEqual(ticket.cerrado_por_usuario_id, self.ids["ASISTENTE"])
            eventos = list(db.scalars(select(HistorialIncidencia).where(HistorialIncidencia.incidencia_id == id_)))
            self.assertEqual(sorted(e.accion for e in eventos), ["CIERRE", "OBSERVACION"])
            observacion = next(e for e in eventos if e.accion == "OBSERVACION")
            self.assertEqual(observacion.usuario_id, self.ids["REPRESENTANTE"])
            self.assertIn(body["observaciones"], observacion.descripcion)
            self.assertEqual(len(list(db.scalars(select(Verificacion).where(Verificacion.incidencia_id == id_)))), 1)

    def test_seguimiento_actual_jefe_muestra_cerradas_observadas_no_reabiertas(self):
        cerrada, reabierta = self.ticket("Cerrado"), self.ticket("En revisión")
        with Session(self.engine) as db:
            for id_ in (cerrada, reabierta):
                db.add(Verificacion(incidencia_id=id_, usuario_id=self.ids["REPRESENTANTE"],
                    resultado="Observación", observaciones="Observación ficticia"))
            db.commit()
        response = self.client.get("/api/seguimiento/observadas")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([r["incidencia_id"] for r in response.json()], [str(cerrada)])
        self.actor = "ASISTENTE"
        self.assertEqual(self.client.get("/api/seguimiento/observadas").status_code, 403)


if __name__ == "__main__":
    unittest.main()
