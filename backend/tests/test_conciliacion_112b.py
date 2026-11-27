"""Lecturas por rol/ciclo y validación del contrato; datos solo en SQLite temporal."""
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.orm import Session

import test_preentrega_111a as fixtures
from app.auth import get_identity
from app.main import app
from app.models import Asignacion, Incidencia, Intervencion, Usuario
from app.schemas import IncidenciaCrear


class Conciliacion112B(unittest.TestCase):
    setUp = fixtures.Preentrega111A.setUp
    tearDown = fixtures.Preentrega111A.tearDown

    def crear_asignada(self, rol="ASISTENTE", area=None, dias=0, ciclo=1):
        id_ = uuid4()
        now = datetime.now(timezone.utc) - timedelta(days=dias)
        with Session(self.engine) as db:
            db.add(Incidencia(id=id_, codigo=f"AISLADO-{id_}", area_id=area or self.area,
                reportante_id=self.ids["REPRESENTANTE"], asunto="Lectura aislada", descripcion="Sin servicio externo",
                estado="En revisión", fecha_registro=now))
            db.add(Asignacion(id=uuid4(), incidencia_id=id_, tecnico_id=self.ids[rol], asignado_por_id=self.ids["JEFE"],
                origen_asignacion="JEFATURA", fecha_asignacion=now))
            db.commit()
        return id_

    def test_columnas_reales_y_aislamiento_del_representante(self):
        id_ = self.crear_asignada()
        externo = self.crear_asignada(area=self.otra_area)
        datos = self.client.get("/api/incidencias?limite=100").json()
        propia = next(t for t in datos if t["id"] == str(id_))
        self.assertEqual(propia["area_nombre"], "Área prueba")
        self.assertEqual(propia["responsable_id"], str(self.ids["ASISTENTE"]))
        self.assertEqual(propia["responsable_nombre"], "ASISTENTE")
        self.assertEqual(propia["responsable_tipo"], "activo")
        self.assertIsNone(propia["prioridad"])
        self.actor = "REPRESENTANTE"
        respuesta = self.client.get("/api/incidencias?limite=100")
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(all(t["area_id"] == str(self.area) for t in respuesta.json()))
        self.assertNotIn(str(externo), {t["id"] for t in respuesta.json()})

    def test_mis_atenciones_filtra_antes_del_limite_y_no_acepta_otro_actor(self):
        antigua = self.crear_asignada(dias=365)
        self.crear_asignada(rol="PRACTICANTE")
        with Session(self.engine) as db:
            for rol, minutos in (("ASISTENTE", 40), ("ASISTENTE", 20), ("PRACTICANTE", 10)):
                db.add(Intervencion(id=uuid4(), incidencia_id=antigua, tecnico_id=self.ids[rol],
                    diagnostico="Prueba", acciones_realizadas="Prueba", duracion_minutos=minutos,
                    es_solucion_final=False, fecha_registro=datetime.now(timezone.utc)))
            db.commit()
        self.actor = "ASISTENTE"
        respuesta = self.client.get(f'/api/incidencias?mis_atenciones=true&limite=1&tecnico_id={self.ids["PRACTICANTE"]}')
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual([t["id"] for t in respuesta.json()], [str(antigua)])
        self.assertIsNotNone(respuesta.json()[0]["fecha_asignacion"])
        self.assertEqual(respuesta.json()[0]["duracion_atencion_minutos"], 60)
        self.actor = "JEFE"
        self.assertEqual(self.client.get("/api/incidencias?mis_atenciones=true").json(), [])
        self.crear_asignada(rol="JEFE")
        self.assertEqual(len(self.client.get("/api/incidencias?mis_atenciones=true").json()), 1)
        self.actor = "REPRESENTANTE"
        self.assertEqual(self.client.get("/api/incidencias?mis_atenciones=true").status_code, 403)
        app.dependency_overrides.pop(get_identity)
        self.assertEqual(self.client.get("/api/incidencias?mis_atenciones=true").status_code, 401)

    def test_reapertura_no_arrastra_responsable_del_ciclo_anterior(self):
        id_ = self.crear_asignada()
        with self.engine.begin() as db:
            db.execute(text("ALTER TABLE incidencias ADD COLUMN ciclo_actual INTEGER NOT NULL DEFAULT 1"))
            db.execute(text("ALTER TABLE asignaciones ADD COLUMN ciclo_atencion INTEGER NOT NULL DEFAULT 1"))
            db.execute(text("ALTER TABLE intervenciones ADD COLUMN ciclo_atencion INTEGER NOT NULL DEFAULT 1"))
            db.execute(text("UPDATE incidencias SET ciclo_actual=2"))
        self.actor = "ASISTENTE"
        with patch("app.lecturas_incidencias.esquema_v4_disponible", return_value=True):
            self.assertEqual(self.client.get("/api/incidencias?mis_atenciones=true").json(), [])
            fila = next(t for t in self.client.get("/api/incidencias?limite=100").json() if t["id"] == str(id_))
            self.assertEqual(fila["responsable_tipo"], "sin_asignar")
            self.assertIsNone(fila["responsable_id"])
            with self.engine.begin() as db:
                db.execute(text("UPDATE asignaciones SET ciclo_atencion=2"))
            self.assertEqual(len(self.client.get("/api/incidencias?mis_atenciones=true").json()), 1)

    def test_cerrada_muestra_cerrador_y_no_es_atencion_activa(self):
        id_ = self.crear_asignada()
        with Session(self.engine) as db:
            ticket = db.get(Incidencia, id_)
            ticket.estado = "Cerrado"
            ticket.cerrado_por_usuario_id = self.ids["ASISTENTE"]
            ticket.fecha_cierre = datetime.now(timezone.utc)
            db.scalar(select(Asignacion).where(Asignacion.incidencia_id == id_)).fecha_fin = ticket.fecha_cierre
            db.commit()
        self.actor = "ASISTENTE"
        self.assertEqual(self.client.get("/api/incidencias?mis_atenciones=true").json(), [])
        fila = next(t for t in self.client.get("/api/incidencias?limite=100").json() if t["id"] == str(id_))
        self.assertEqual(fila["responsable_tipo"], "cierre")
        self.assertEqual(fila["responsable_nombre"], "ASISTENTE")

    def test_avisos_solo_muestran_asignaciones_activas_de_jefatura_al_destinatario(self):
        propia = self.crear_asignada(rol="ASISTENTE")
        auto = self.crear_asignada(rol="ASISTENTE")
        otra = self.crear_asignada(rol="PRACTICANTE")
        with Session(self.engine) as db:
            asignacion = db.scalar(select(Asignacion).where(Asignacion.incidencia_id == auto))
            asignacion.asignado_por_id = self.ids["ASISTENTE"]
            asignacion.origen_asignacion = "AUTOTOMA"
            db.commit()
        ruta = "/api/incidencias/avisos/asignaciones"
        for rol, destino in (("ASISTENTE", propia), ("PRACTICANTE", otra)):
            self.actor = rol
            respuesta = self.client.get(ruta)
            self.assertEqual(respuesta.status_code, 200, respuesta.text)
            self.assertEqual([a["incidencia"]["id"] for a in respuesta.json()], [str(destino)])
        self.actor = "REPRESENTANTE"
        self.assertEqual(self.client.get(ruta).status_code, 403)

    def test_inactivo_no_accede_y_configuracion_no_asume_permisos(self):
        self.permisos_patch.stop()  # Esta prueba verifica el detector real, no el doble de edición.
        self.actor = "PRACTICANTE"
        with Session(self.engine) as db:
            db.get(Usuario, self.ids[self.actor]).habilitado = False
            db.commit()
        self.assertEqual(self.client.get("/api/incidencias?mis_atenciones=true").status_code, 403)
        self.actor = "JEFE"
        config = self.client.get("/api/administracion/configuracion").json()
        self.assertFalse(config["permisos_verificados"])
        self.assertFalse(config["edicion_habilitada"])
        self.assertFalse(config["invitaciones_habilitadas"])
        with patch("app.routes.usuarios.permisos_administrativos_verificados", return_value=True):
            self.assertTrue(self.client.get("/api/administracion/configuracion").json()["edicion_habilitada"])

    def test_registro_admite_campos_existentes_y_rechaza_campos_controlados(self):
        datos = IncidenciaCrear(asunto="Caso", descripcion="Prueba aislada", fecha_inicio_problema="2026-01-01", hora_inicio_problema="08:30", impacto="Si")
        self.assertEqual(datos.model_dump(mode="json")["fecha_inicio_problema"], "2026-01-01")
        self.assertEqual(datos.model_dump(mode="json")["hora_inicio_problema"], "08:30:00")
        self.actor = "REPRESENTANTE"
        for campo in ("area_id", "reportante_id", "estado", "codigo", "archivos"):
            self.assertEqual(self.client.post("/api/incidencias", json={"asunto": "Caso", "descripcion": "Prueba", campo: "no-admitido"}).status_code, 422)
        anterior = self.crear_asignada(area=self.otra_area)
        body = {"asunto": "Caso", "descripcion": "Prueba", "reincidente": True, "incidencia_anterior_id": str(anterior)}
        self.assertEqual(self.client.post("/api/incidencias", json=body).status_code, 404)
        anterior = self.crear_asignada()
        self.assertEqual(self.client.post("/api/incidencias", json={**body, "incidencia_anterior_id": str(anterior)}).status_code, 409)

    def test_vacio_conserva_indicadores_cero_y_no_crea_datos(self):
        with Session(self.engine) as db:
            db.query(Incidencia).delete()
            db.commit()
        self.assertEqual(self.client.get("/api/incidencias").json(), [])
        self.assertEqual(self.client.get("/api/incidencias/resumen").json(), dict(total=0, pendientes=0, en_revision=0, cerradas=0))
        self.assertEqual(self.client.get("/api/me").json()["rol"], "JEFE")


if __name__ == "__main__":
    unittest.main()
