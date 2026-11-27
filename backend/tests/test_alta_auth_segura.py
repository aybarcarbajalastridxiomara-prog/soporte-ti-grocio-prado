"""Contratos de Admin Auth simulados. No acceden a Supabase ni envían correo."""
import json
import unittest
from dataclasses import replace
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException
from app.config import get_settings
from app.supabase_admin import identidad_pendiente, invitar_en_supabase, retorno_auth_verificado


class AltaAuthSegura(unittest.TestCase):
    def setUp(self):
        self.solicitud, self.identidad = uuid4(), uuid4()
        self.settings = replace(get_settings(), supabase_url="https://qa-ficticio.supabase.co",
            supabase_service_role_key="sb_secret_ficticia_no_operativa",
            frontend_url="https://frontend-qa.example.invalid/", environment="qa")
        self.settings_patch = patch("app.supabase_admin.get_settings", return_value=self.settings)
        self.settings_patch.start()
        self.addCleanup(self.settings_patch.stop)
        self.cuenta = {"id": str(self.identidad), "email": "prueba@example.invalid", "email_confirmed_at": None,
            "app_metadata": {"alta_municipal": {"solicitud": str(self.solicitud), "huella": "hash-ficticio"}}}

    def crear(self):
        return identidad_pendiente("prueba@example.invalid", self.solicitud, "hash-ficticio")

    def test_creacion_sin_password_confirmacion_o_envio(self):
        with patch("app.supabase_admin.peticion_privada", return_value=(201, json.dumps(self.cuenta).encode())) as call:
            self.assertEqual(self.crear(), self.identidad)
            call.assert_called_once()
            self.assertEqual(call.call_args.args[0], "https://qa-ficticio.supabase.co/auth/v1/admin/users")
            body = json.loads(call.call_args.kwargs["data"])
            self.assertEqual(set(body), {"email", "email_confirm", "app_metadata"})
            self.assertFalse(body["email_confirm"])
            self.assertNotIn("Authorization", call.call_args.kwargs["headers"])

    def test_respuesta_perdida_concilia_solo_marcador_admin_y_correo(self):
        with patch("app.supabase_admin.peticion_privada", side_effect=[
            (422, b""), (200, json.dumps({"users": [self.cuenta]}).encode())]) as call:
            self.assertEqual(self.crear(), self.identidad)
            self.assertEqual(call.call_count, 2)
            self.assertNotIn("method", call.call_args.kwargs)

    def test_no_adopta_identidad_antigua_confirmada_o_de_otra_solicitud(self):
        for cambios in ({"app_metadata": {}}, {"email_confirmed_at": "2026-11-27"},
                        {"app_metadata": {"alta_municipal": {"solicitud": str(uuid4()), "huella": "hash-ficticio"}}}):
            with self.subTest(cambios=cambios), patch("app.supabase_admin.peticion_privada", side_effect=[
                (422, b""), (200, json.dumps({"users": [{**self.cuenta, **cambios}]}).encode())]) as call:
                with self.assertRaises(HTTPException) as error:
                    self.crear()
                self.assertEqual(error.exception.status_code, 409)
                self.assertEqual(call.call_count, 2)

    def test_paginacion_no_asume_que_el_correo_esta_en_primera_pagina(self):
        otras = [{"email": f"otro{i}@example.invalid"} for i in range(100)]
        with patch("app.supabase_admin.peticion_privada", side_effect=[(422, b""),
                (200, json.dumps({"users": otras}).encode()),
                (200, json.dumps({"users": [self.cuenta]}).encode())]) as call:
            self.assertEqual(self.crear(), self.identidad)
            self.assertIn("page=2&per_page=100", call.call_args.args[0])

    def test_error_no_expone_cuerpo_del_proveedor_ni_clave(self):
        for estado, esperado in ((429, 429), (500, 502), (302, 502)):
            with self.subTest(estado=estado), patch("app.supabase_admin.peticion_privada", return_value=(estado, b"dato-privado")):
                with self.assertRaises(HTTPException) as error:
                    self.crear()
                self.assertEqual(error.exception.status_code, esperado)
                self.assertNotIn("dato-privado", error.exception.detail)
                self.assertNotIn("sb_secret", error.exception.detail)

    def test_invitacion_usa_retorno_configurado_y_no_datos_del_formulario(self):
        with patch("app.supabase_admin.peticion_privada", return_value=(200, b"{}")) as call:
            invitar_en_supabase("prueba@example.invalid")
            self.assertTrue(call.call_args.args[0].startswith("https://qa-ficticio.supabase.co/auth/v1/invite?redirect_to="))
            self.assertIn("frontend-qa.example.invalid", call.call_args.args[0])
            self.assertEqual(json.loads(call.call_args.kwargs["data"]), {"email": "prueba@example.invalid"})

    def test_retorno_inseguro_o_con_tokens_bloqueado_antes_de_red(self):
        for destino in ("http://sitio.example.invalid", "https://sitio.example.invalid/?token=privado",
                        "https://usuario:clave@sitio.example.invalid", "https://sitio.example.invalid/#token"):
            with self.subTest(destino=destino), patch("app.supabase_admin.get_settings", return_value=replace(self.settings, frontend_url=destino)), patch("app.supabase_admin.peticion_privada") as call:
                with self.assertRaises(HTTPException):
                    invitar_en_supabase("prueba@example.invalid")
                call.assert_not_called()
        with patch("app.supabase_admin.get_settings", return_value=replace(self.settings, frontend_url="http://127.0.0.1:5173", environment="production")):
            with self.assertRaises(HTTPException):
                retorno_auth_verificado()


if __name__ == "__main__":
    unittest.main()
