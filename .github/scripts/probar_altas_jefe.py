"""Altas y concurrencia con PostgreSQL local marcado y Auth simulado; cero envíos."""
import argparse
from dataclasses import replace
import json
from threading import Barrier
from concurrent.futures import ThreadPoolExecutor
import unittest
from unittest.mock import patch
from uuid import uuid4

import probar_funcional_112c as fixture
from sqlalchemy import text
from app.config import get_settings


class AltasJefe(fixture.FuncionesV3):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        with fixture.admin(cls.database) as con:
            for archivo in ("04_administracion_perfiles.sql", "05_complementos_112e.sql"):
                con.execute((fixture.ROOT / "database" / archivo).read_text(encoding="utf-8-sig"))

    def setUp(self):
        super().setUp()
        self.settings = replace(get_settings(), administracion_perfiles_habilitada=False,
            invitaciones_usuarios_habilitadas=True, supabase_url="https://qa-ficticio.supabase.co",
            frontend_url="https://frontend.example.invalid",
            supabase_service_role_key="sb_secret_ficticia_no_operativa", supabase_smtp_configurado=True)
        self.settings_patch = patch("app.routes.usuarios.get_settings", return_value=self.settings)
        self.settings_patch.start()
        self.addCleanup(self.settings_patch.stop)
        self.creadas, self.enviadas = [], []

        def crear(correo, solicitud, huella):
            id_ = uuid4()
            # Tabla Auth mínima del fixture LOCAL, no Supabase ni cuentas reales.
            with fixture.admin(self.database) as con:
                con.execute("INSERT INTO auth.users(id) VALUES (%s)", (id_,))
            self.creadas.append(id_)
            return id_

        def enviar(correo):
            id_ = self.creadas[-1]
            with self.engine.connect() as con:
                assert con.execute(text("SELECT id FROM public.usuarios WHERE id=:id"), {"id": id_}).scalar_one() == id_
            self.enviadas.append(id_)
            return {"id": str(id_)}

        self.crear_mock = patch("app.routes.usuarios.identidad_pendiente", side_effect=crear).start()
        self.enviar_mock = patch("app.routes.usuarios.invitar_en_supabase", side_effect=enviar).start()
        self.addCleanup(patch.stopall)

    def body(self, nombre="alta_ficticia"):
        nombre += "_" + uuid4().hex[:10]
        return {"nombre_completo": "Perfil ficticio local", "usuario": nombre, "rol": "REPRESENTANTE",
            "area_id": str(self.area), "correo": nombre + "@example.invalid", "solicitud_id": str(uuid4())}

    def test_permisos_reales_con_rls_y_sin_edicion_habilitada(self):
        c = self.request("JEFE", "GET", "/api/administracion/configuracion")
        self.assertEqual(c.status_code, 200, c.text)
        self.assertTrue(c.json()["permisos_alta_verificados"])
        self.assertFalse(c.json()["edicion_habilitada"])
        body = self.body()
        for _ in range(2):
            r = self.request("JEFE", "POST", "/api/usuarios/invitar", body)
            self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(len(self.creadas), 1)
        self.assertEqual(self.creadas, self.enviadas)
        self.assertEqual(self.request("ASISTENTE", "POST", "/api/usuarios/invitar", self.body("no_autorizado")).status_code, 403)
        self.assertEqual(self.request("JEFE", "PATCH", f'/api/usuarios/{self.ids["ASISTENTE"]}', {"habilitado": False}).status_code, 503)
        row = self.fila("SELECT rol,area_id FROM public.usuarios WHERE id=:id", id=self.creadas[0])
        self.assertEqual((row["rol"], row["area_id"]), ("REPRESENTANTE", self.area))

    def test_cupo_concurrente_se_serializa_sin_crear_auth_huerfano(self):
        a, b = self.body("alta_a"), self.body("alta_b")
        self.simultaneas([lambda: self.request("JEFE", "POST", "/api/usuarios/invitar", a),
                         lambda: self.request("JEFE", "POST", "/api/usuarios/invitar", b)])
        self.assertEqual(len(self.creadas), 1)
        self.assertEqual(len(self.enviadas), 1)
        self.assertEqual(self.fila("SELECT count(*) n FROM public.usuarios WHERE area_id=:area AND rol='REPRESENTANTE' AND habilitado", area=self.area)["n"], 2)

    def test_reintento_concurrente_no_duplica_envio(self):
        body = self.body()
        barrera = Barrier(2)
        def pedir():
            barrera.wait(timeout=10)
            return self.request("JEFE", "POST", "/api/usuarios/invitar", body)
        with ThreadPoolExecutor(max_workers=2) as executor:
            respuestas = list(executor.map(lambda _: pedir(), range(2)))
        self.assertIn(201, [r.status_code for r in respuestas], [r.text for r in respuestas])
        self.assertTrue(all(r.status_code in {201, 409} for r in respuestas), [r.text for r in respuestas])
        self.assertEqual(len(self.enviadas), 1)
        self.assertEqual(len(self.creadas), 1)

    def test_falta_permiso_auditoria_bloquea_antes_de_auth(self):
        with fixture.admin(self.database) as con:
            con.execute("REVOKE INSERT ON public.auditoria_administrativa FROM soporte_ti_api")
        try:
            self.assertEqual(self.request("JEFE", "POST", "/api/usuarios/invitar", self.body()).status_code, 503)
            self.crear_mock.assert_not_called()
            self.enviar_mock.assert_not_called()
        finally:
            with fixture.admin(self.database) as con:
                con.execute("GRANT INSERT ON public.auditoria_administrativa TO soporte_ti_api")

    def test_reasignacion_con_bloqueo_de_perfil_y_permisos_administrativos(self):
        id_, ruta, body = self.preparar_reasignacion()
        r = self.request("JEFE", "POST", ruta, body)
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(r.json()["tecnico_id"], str(self.ids["PRACTICANTE"]))

    def test_reasignar_y_deshabilitar_concurrentes_no_dejan_responsable_bloqueado(self):
        id_, ruta, body = self.preparar_reasignacion()
        barrera = Barrier(2)
        with patch("app.routes.usuarios.get_settings", return_value=replace(self.settings, administracion_perfiles_habilitada=True)):
            def reasignar():
                barrera.wait(timeout=10)
                return self.request("JEFE", "POST", ruta, body)
            def deshabilitar():
                barrera.wait(timeout=10)
                return self.request("JEFE", "PATCH", f'/api/usuarios/{self.ids["PRACTICANTE"]}', {"habilitado": False})
            with ThreadPoolExecutor(max_workers=2) as executor:
                a, b = executor.submit(reasignar), executor.submit(deshabilitar)
                respuestas = [a.result(), b.result()]
        codigos = [r.status_code for r in respuestas]
        self.assertIn(codigos, ([201, 409], [422, 200]), [r.text for r in respuestas])
        fila = self.fila("SELECT u.habilitado FROM public.asignaciones a JOIN public.usuarios u ON u.id=a.tecnico_id WHERE a.incidencia_id=:id AND a.fecha_fin IS NULL", id=fixture.UUID(id_))
        self.assertTrue(fila["habilitado"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--puerto", type=int, required=True)
    args = parser.parse_args()
    if not 1024 < args.puerto < 65536:
        raise SystemExit("Puerto local inválido")
    fixture.PORT = args.puerto
    with fixture.admin():
        pass
    nombres = ["test_permisos_reales_con_rls_y_sin_edicion_habilitada",
        "test_cupo_concurrente_se_serializa_sin_crear_auth_huerfano", "test_reintento_concurrente_no_duplica_envio",
        "test_falta_permiso_auditoria_bloquea_antes_de_auth",
        "test_reasignacion_con_bloqueo_de_perfil_y_permisos_administrativos",
        "test_reasignar_y_deshabilitar_concurrentes_no_dejan_responsable_bloqueado"]
    suite = unittest.TestSuite(AltasJefe(n) for n in nombres)
    resultado = unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(not resultado.wasSuccessful())
