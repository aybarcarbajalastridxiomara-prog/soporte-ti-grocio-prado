"""Regresiones aisladas: no hay conexiones a Supabase ni a PostgreSQL real."""
import os
import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
from uuid import UUID, uuid4

os.environ["DATABASE_URL"] = ""
os.environ["SUPABASE_URL"] = ""

from fastapi.testclient import TestClient
from sqlalchemy import MetaData, create_engine, event, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.auth import get_identity
from app.config import get_settings
from app.db import get_db
from app.main import app
from app.models import Area, Asignacion, HistorialIncidencia, Incidencia, Usuario, AuditoriaAdministrativa


class Preentrega111A(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        # Copias aisladas, sin FK de auth.users ni defaults PostgreSQL.
        metadata = MetaData()
        for original in (Area.__table__, Usuario.__table__, Incidencia.__table__, Asignacion.__table__, HistorialIncidencia.__table__, AuditoriaAdministrativa.__table__):
            table = original.to_metadata(metadata)
            for constraint in list(table.foreign_key_constraints):
                table.constraints.remove(constraint)
            table.foreign_keys.clear()
            for column in table.columns:
                column.foreign_keys.clear()
                column.server_default = None
        metadata.create_all(self.engine)
        self.area, self.otra_area, self.inactiva = uuid4(), uuid4(), uuid4()
        self.ids = {rol: uuid4() for rol in ("JEFE", "ASISTENTE", "PRACTICANTE", "REPRESENTANTE")}
        now = datetime.now(timezone.utc)
        with Session(self.engine) as db:
            for id_, nombre, activa in ((self.area, "Área prueba", True), (self.otra_area, "Área externa", True), (self.inactiva, "Área inactiva", False)):
                db.add(Area(id=id_, nombre=nombre, activo=activa, fecha_creacion=now))
            for rol, id_ in self.ids.items():
                db.add(Usuario(id=id_, nombre_completo=rol, usuario=rol.lower(), rol=rol, area_id=self.area, habilitado=True, fecha_creacion=now))
            for index in range(120):
                db.add(Incidencia(id=uuid4(), codigo=f"PRUEBA-{index}", area_id=self.area if index < 90 else self.otra_area,
                    reportante_id=self.ids["REPRESENTANTE"], asunto="Caso aislado", descripcion="Solo prueba",
                    estado=("Pendiente", "En revisión", "Cerrado")[index % 3], fecha_registro=now))
            db.commit()
        self.actor = "JEFE"
        def session():
            with Session(self.engine) as db:
                yield db
        app.dependency_overrides[get_db] = session
        app.dependency_overrides[get_identity] = lambda: self.ids[self.actor]
        self.settings = replace(get_settings(), administracion_perfiles_habilitada=True,
            supabase_service_role_key="secreto-solo-prueba", supabase_url="https://supabase.example.invalid",
            supabase_smtp_configurado=True)
        self.config_patch = patch("app.routes.usuarios.get_settings", lambda: self.settings)
        self.config_patch.start()
        self.permisos_patch = patch("app.routes.usuarios.permisos_administrativos_verificados", return_value=True)
        self.permisos_patch.start()
        self.addCleanup(self.permisos_patch.stop)
        self.ciclo_patch = patch("app.lecturas_incidencias.esquema_v4_disponible", return_value=False)
        self.ciclo_patch.start()
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.config_patch.stop()
        self.ciclo_patch.stop()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def test_conteos_completos_y_aislamiento_por_area(self):
        self.assertEqual(len(self.client.get("/api/incidencias").json()), 50)
        self.assertEqual(self.client.get("/api/incidencias/resumen").json(), {"total": 120, "pendientes": 40, "en_revision": 40, "cerradas": 40})
        self.actor = "REPRESENTANTE"
        self.assertEqual(self.client.get("/api/incidencias/resumen").json(), {"total": 90, "pendientes": 30, "en_revision": 30, "cerradas": 30})

    def test_rutas_nuevas_exigen_autenticacion_y_jefatura(self):
        rutas = ["/api/usuarios", "/api/areas", "/api/administracion/configuracion"]
        for rol in ("REPRESENTANTE", "ASISTENTE", "PRACTICANTE"):
            self.actor = rol
            for ruta in rutas:
                self.assertEqual(self.client.get(ruta).status_code, 403)
            self.assertEqual(self.client.patch(f'/api/usuarios/{self.ids["JEFE"]}', json={"rol": "JEFE"}).status_code, 403)
            self.assertEqual(self.client.post("/api/usuarios/invitar", json=self.invitacion()).status_code, 403)
        app.dependency_overrides.pop(get_identity)
        for ruta in rutas + ["/api/incidencias/resumen"]:
            self.assertEqual(self.client.get(ruta).status_code, 401)
        self.assertEqual(self.client.post("/api/usuarios/invitar", json=self.invitacion()).status_code, 401)
        self.assertEqual(self.client.patch(f'/api/usuarios/{self.ids["JEFE"]}', json={"habilitado": False}).status_code, 401)

    def test_consulta_no_expone_secretos(self):
        self.assertEqual(len(self.client.get("/api/usuarios").json()), 4)
        self.assertEqual(len(self.client.get("/api/areas").json()), 3)
        response = self.client.get("/api/administracion/configuracion")
        self.assertNotIn("secreto-solo-prueba", response.text)
        self.assertNotIn("service_role_key", response.text)

    def test_correo_consulta_auth_por_uuid_sin_migracion_y_solo_como_jefe(self):
        tecnico = self.ids["ASISTENTE"]
        ruta = f"/api/usuarios/{tecnico}/correo"
        with patch("app.routes.usuarios.consultar_correo_supabase", return_value="tecnico@example.test") as consultar:
            self.actor = "REPRESENTANTE"
            self.assertEqual(self.client.get(ruta).status_code, 403)
            self.actor = "JEFE"
            self.assertEqual(self.client.get(f"/api/usuarios/{uuid4()}/correo").status_code, 404)
            consultar.assert_not_called()
            respuesta = self.client.get(ruta)
            self.assertEqual(respuesta.json(), {"correo": "tecnico@example.test"})
            self.assertEqual(respuesta.headers["cache-control"], "no-store")
            consultar.assert_called_once_with(tecnico)

    def test_actualizar_rol_area_y_deshabilitar_revoca_acceso(self):
        target = self.ids["ASISTENTE"]
        response = self.client.patch(f"/api/usuarios/{target}", json={"rol": "PRACTICANTE", "area_id": str(self.otra_area), "habilitado": False})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()["habilitado"])
        historial = self.client.get("/api/administracion/historial").json()
        self.assertEqual(len(historial), 1)
        self.assertEqual(historial[0]["anterior"]["rol"], "ASISTENTE")
        self.assertEqual(historial[0]["nuevo"]["rol"], "PRACTICANTE")
        self.assertEqual(historial[0]["actor_id"], str(self.ids["JEFE"]))
        self.actor = "ASISTENTE"
        self.assertEqual(self.client.get("/api/me").status_code, 403)
        self.assertEqual(self.client.get("/api/incidencias/resumen").status_code, 403)
        self.actor = "JEFE"
        self.assertEqual(self.client.patch(f"/api/usuarios/{target}", json={"habilitado": True}).status_code, 200)

    def test_validacion_y_autoproteccion(self):
        target = self.ids["ASISTENTE"]
        for body in ({}, {"rol": "ADMIN"}, {"rol": None}, {"habilitado": "false"}, {"id": str(uuid4())}, {"usuario": " "}, {"area_id": str(self.inactiva)}, {"area_id": str(uuid4())}):
            self.assertEqual(self.client.patch(f"/api/usuarios/{target}", json=body).status_code, 422)
        self.assertEqual(self.client.patch(f"/api/usuarios/{target}", json={"usuario": "jefe"}).status_code, 409)
        for body in ({"habilitado": False}, {"rol": "REPRESENTANTE"}):
            self.assertEqual(self.client.patch(f'/api/usuarios/{self.ids["JEFE"]}', json=body).status_code, 409)

    def test_menu_preserva_edicion_y_bloquea_retiro_con_asignacion_activa(self):
        tecnico = self.ids["ASISTENTE"]
        ruta = f"/api/usuarios/{tecnico}/acciones"
        with Session(self.engine) as db:
            db.add(Asignacion(id=uuid4(), incidencia_id=uuid4(), tecnico_id=tecnico,
                asignado_por_id=self.ids["JEFE"], origen_asignacion="JEFATURA",
                fecha_asignacion=datetime.now(timezone.utc)))
            db.commit()
        self.assertEqual(self.client.post(ruta, json={"accion": "deshabilitar"}).status_code, 409)
        self.assertEqual(self.client.post(ruta, json={"accion": "archivar"}).status_code, 503)
        self.actor = "ASISTENTE"
        self.assertEqual(self.client.post(ruta, json={"accion": "eliminar"}).status_code, 403)

    def test_restaurar_y_habilitar_devuelve_acceso_y_registra_auditoria(self):
        tecnico = self.ids["ASISTENTE"]
        with self.engine.begin() as conexion:
            conexion.execute(text("ALTER TABLE usuarios ADD COLUMN archivado BOOLEAN NOT NULL DEFAULT FALSE"))
            conexion.execute(text("UPDATE usuarios SET archivado = TRUE, habilitado = FALSE WHERE usuario = 'asistente'"))

        @event.listens_for(self.engine, "before_cursor_execute", retval=True)
        def adaptar_esquema(_conexion, _cursor, sentencia, parametros, _contexto, _ejecutar_varios):
            if "public.usuarios" in sentencia:
                sentencia = sentencia.replace("public.usuarios", "usuarios")
                parametros = tuple(valor.hex if isinstance(valor, UUID) else valor for valor in parametros)
            return sentencia, parametros

        with patch("app.routes.usuarios.gestion_ampliada_disponible", return_value=True):
            respuesta = self.client.post(f"/api/usuarios/{tecnico}/acciones", json={"accion": "restaurar_habilitado"})
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        registro = self.client.get("/api/administracion/historial").json()[0]
        self.assertEqual(registro["accion"], "RESTAURAR_PERFIL")
        self.assertTrue(registro["nuevo"]["habilitado"])
        self.assertFalse(registro["nuevo"]["archivado"])

    def test_reenvio_reutiliza_correo_y_limita_intentos_tras_error(self):
        tecnico = self.ids["ASISTENTE"]
        ruta = f"/api/usuarios/{tecnico}/acciones"
        with Session(self.engine) as db:
            usuario = db.get(Usuario, tecnico)
            usuario.habilitado = False
            usuario.fecha_creacion = datetime.now(timezone.utc) - timedelta(days=1)
            db.commit()
        cuenta = {"id": tecnico, "correo": "tecnico@example.test", "activado": False,
                  "confirmado": True, "invitado": True}
        prefijo = "app.routes.usuarios."
        with patch(prefijo + "gestion_ampliada_disponible", return_value=True), \
             patch(prefijo + "perfil_archivado", return_value=False), \
             patch(prefijo + "directorio_auth", return_value=[cuenta]), \
             patch(prefijo + "recuperar_en_supabase") as enviar:
            from fastapi import HTTPException
            enviar.side_effect = HTTPException(502, "Respuesta incierta")
            self.assertEqual(self.client.post(ruta, json={"accion": "reenviar"}).status_code, 502)
            self.assertEqual(self.client.post(ruta, json={"accion": "reenviar"}).status_code, 429)
            enviar.assert_called_once_with(cuenta["correo"])
        with Session(self.engine) as db:
            self.assertFalse(db.get(Usuario, tecnico).habilitado)

    def test_reenvio_usa_enlace_al_mismo_correo_si_auth_rechaza_reinvitar(self):
        from fastapi import HTTPException

        tecnico = self.ids["ASISTENTE"]
        with Session(self.engine) as db:
            db.get(Usuario, tecnico).fecha_creacion = datetime.now(timezone.utc) - timedelta(days=1)
            db.commit()
        cuenta = {"id": tecnico, "correo": "tecnico@example.test", "activado": False,
                  "confirmado": False, "invitado": True}
        prefijo = "app.routes.usuarios."
        with patch(prefijo + "gestion_ampliada_disponible", return_value=True), \
             patch(prefijo + "perfil_archivado", return_value=False), \
             patch(prefijo + "directorio_auth", return_value=[cuenta]), \
             patch(prefijo + "invitar_en_supabase", side_effect=HTTPException(409)), \
             patch(prefijo + "consultar_correo_supabase", return_value=cuenta["correo"]), \
             patch(prefijo + "recuperar_en_supabase") as enviar:
            resultado = self.client.post(f"/api/usuarios/{tecnico}/acciones", json={"accion": "reenviar"})
            self.assertEqual(resultado.status_code, 200, resultado.text)
            enviar.assert_called_once_with(cuenta["correo"])

    def test_permiso_db_no_verificado_bloquea_edicion_e_invitacion(self):
        with patch("app.routes.usuarios.permisos_administrativos_verificados", return_value=False), patch("app.routes.usuarios.invitar_en_supabase") as externo:
            self.assertEqual(self.client.patch(f'/api/usuarios/{self.ids["ASISTENTE"]}',json={"habilitado":False}).status_code,503)
            self.assertEqual(self.client.post("/api/usuarios/invitar",json=self.invitacion()).status_code,503)
            externo.assert_not_called()

    def invitacion(self):
        return {"nombre_completo": "Prueba aislada", "usuario": "prueba_nueva", "correo": "prueba@example.invalid", "rol": "REPRESENTANTE", "area_id": str(self.area)}

    def test_faltantes_bloquean_invitacion_antes_de_contactar_supabase(self):
        for cambios in ({"administracion_perfiles_habilitada": False}, {"supabase_service_role_key": ""}, {"supabase_smtp_configurado": False}):
            self.settings = replace(self.settings, **cambios)
            with patch("app.routes.usuarios.invitar_en_supabase") as invite:
                self.assertEqual(self.client.post("/api/usuarios/invitar", json=self.invitacion()).status_code, 503)
                invite.assert_not_called()
        self.assertEqual(self.client.patch(f'/api/usuarios/{self.ids["ASISTENTE"]}', json={"habilitado": False}).status_code, 503)

    def test_invitacion_y_rechazo_de_sobrescritura(self):
        with patch("app.routes.usuarios.invitar_en_supabase", return_value={"id": str(uuid4())}) as invite:
            # El perfil necesita el default PostgreSQL de fecha en producción.
            from sqlalchemy import event
            def default_fecha(mapper, connection, target):
                target.fecha_creacion = datetime.now(timezone.utc)
            event.listen(Usuario, "before_insert", default_fecha)
            try:
                response = self.client.post("/api/usuarios/invitar", json=self.invitacion())
            finally:
                event.remove(Usuario, "before_insert", default_fecha)
            self.assertEqual(response.status_code, 201, response.text)
            invite.assert_called_once_with("prueba@example.invalid")
        with patch("app.routes.usuarios.invitar_en_supabase", return_value={"id": str(self.ids["JEFE"])}) as invite:
            self.assertEqual(self.client.post("/api/usuarios/invitar", json={**self.invitacion(), "usuario": "otra_prueba"}).status_code, 409)
        self.assertEqual(self.client.get("/api/me").json()["rol"], "JEFE")

    def test_cupo_completo_se_rechaza_antes_de_crear_identidad_auth(self):
        with Session(self.engine) as db:
            db.get(Usuario, self.ids["PRACTICANTE"]).rol = "REPRESENTANTE"
            db.commit()
        with patch("app.routes.usuarios.invitar_en_supabase") as externo:
            self.assertEqual(self.client.post("/api/usuarios/invitar",json=self.invitacion()).status_code,409)
            externo.assert_not_called()


if __name__ == "__main__":
    unittest.main()
