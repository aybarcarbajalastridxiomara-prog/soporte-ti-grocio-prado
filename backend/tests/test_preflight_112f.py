"""Pruebas offline de las guardas del preflight; sin credenciales operativas."""
import importlib.util
from pathlib import Path
import sys
import unittest
from dataclasses import replace
from unittest.mock import patch

SCRIPT=Path(__file__).resolve().parents[2]/'.github/scripts/qa_supabase_112f.py'
spec=importlib.util.spec_from_file_location('qa_preflight_112f',SCRIPT)
qa=importlib.util.module_from_spec(spec);sys.modules[spec.name]=qa;spec.loader.exec_module(qa)

class Preflight112F(unittest.TestCase):
    def entorno(self):
        return {'GROCIO_QA_DATABASE_URL':f'postgresql+psycopg://soporte_ti_api:no-operativa@db.{qa.PROJECT}.supabase.co:5432/postgres?sslmode=verify-full',
            'GROCIO_QA_SERVICE_ROLE_KEY':'sb_secret_ficticia_no_operativa','GROCIO_QA_PUBLIC_KEY':'sb_publishable_ficticia_no_operativa'}
    def test_configuracion_no_conecta_ni_revela_valores(self):
        with patch.object(qa,'verificar_remoto') as network:
            config=qa.configuracion(self.entorno());network.assert_not_called()
        self.assertNotIn('no-operativa',repr(config));self.assertNotIn('sb_secret',repr(config))
    def test_credenciales_heredadas_y_proyecto_municipal_no_sirven(self):
        with self.assertRaises(qa.QANoPreparado):qa.configuracion({'DATABASE_URL':'ignorar','SUPABASE_SERVICE_ROLE_KEY':'ignorar'})
        for origin in ['https://dkfpgvxjnsvlphiakpps.supabase.co','http://localhost:54321',qa.ORIGIN+'/otra']:
            with self.subTest(origin=origin),self.assertRaises(qa.QANoPreparado):qa.configuracion({**self.entorno(),'GROCIO_QA_SUPABASE_URL':origin})
    def test_dsn_restringido_sin_superusuario_opciones_ni_tls_debil(self):
        for dsn in [f'postgresql+psycopg://postgres:secreto@db.{qa.PROJECT}.supabase.co/postgres?sslmode=verify-full',
            self.entorno()['GROCIO_QA_DATABASE_URL'].replace('verify-full','require'),
            self.entorno()['GROCIO_QA_DATABASE_URL']+'&options=-csearch_path=public',
            self.entorno()['GROCIO_QA_DATABASE_URL'].replace(qa.PROJECT,'otro-proyecto')]:
            with self.subTest(),self.assertRaises(qa.QANoPreparado) as error:qa.configuracion({**self.entorno(),'GROCIO_QA_DATABASE_URL':dsn})
            self.assertNotIn('secreto',str(error.exception));self.assertNotIn('no-operativa',str(error.exception))
    def test_inventario_incluye_solo_migraciones_existentes_en_orden(self):
        files=qa.inventario()['migraciones_ordenadas']
        self.assertEqual(len(files),5);self.assertTrue(all(len(f['sha256'])==64 for f in files))
        self.assertEqual([Path(f['archivo']).name for f in files],qa.MIGRATIONS)

    def test_backend_conserva_tls_fuerte_y_oculta_parametros(self):
        from app.config import get_settings
        from app.db import get_engine
        base=get_settings()
        for mode in ('verify-full','verify-ca','require'):
            with self.subTest(mode=mode),patch('app.db.get_settings',return_value=replace(base,database_url=self.entorno()['GROCIO_QA_DATABASE_URL'].replace('verify-full',mode))),patch('app.db.create_engine') as create:
                get_engine.cache_clear();get_engine()
                self.assertEqual(create.call_args.kwargs['connect_args']['sslmode'],mode)
                self.assertTrue(create.call_args.kwargs['hide_parameters'])
        with patch('app.db.get_settings',return_value=replace(base,database_url=self.entorno()['GROCIO_QA_DATABASE_URL'].replace('verify-full','disable'))),patch('app.db.create_engine') as create:
            get_engine.cache_clear()
            with self.assertRaises(ValueError):get_engine()
            create.assert_not_called()
        get_engine.cache_clear()

if __name__=='__main__':unittest.main()
