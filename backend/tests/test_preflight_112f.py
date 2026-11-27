"""Pruebas offline de las guardas del preflight; sin credenciales operativas."""
import importlib.util
from pathlib import Path
import sys
import unittest
from dataclasses import replace
from types import SimpleNamespace
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
        for origin in ['https://dkfpgvxjnsvlphiakpps.supabase.co','https://sygfauunjvhaoyczdhuu.supabase.co','http://localhost:54321',qa.ORIGIN+'/otra']:
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


class MarcaPrivada112F(unittest.TestCase):
    class Result:
        def __init__(self,value):self.value=value
        def one(self):return self.value
        def one_or_none(self):return self.value
        def all(self):return self.value

    class Connection:
        def __init__(self):
            self.driver=SimpleNamespace(
                info=SimpleNamespace(host=f'db.{qa.PROJECT}.supabase.co',user='soporte_ti_api',port=5432,dbname='postgres'),
                pgconn=SimpleNamespace(ssl_in_use=True))
            self.connection=SimpleNamespace(driver_connection=self.driver)
            self.identity=('postgres','soporte_ti_api','on')
            self.control=('postgres','postgres','r',True,False)
            self.rows=[(qa.PROJECT,qa.ORIGIN,qa.PROJECT_NAME,'postgres',1,'postgres')]
            self.forbidden=(False,False,False,False,False,False)
            self.policies=[('SELECT',['soporte_ti_api'],'singleton',None,'PERMISSIVE')]
            self.queries=[]
        def execute(self,statement):
            text=str(statement)
            if not text.lstrip().upper().startswith('SELECT'):
                raise AssertionError('La verificacion solo admite SELECT')
            self.queries.append(text)
            if text.lstrip().startswith('SELECT current_database()'):value=self.identity
            elif 'pg_get_userbyid(n.nspowner)' in text:value=self.control
            elif 'SELECT project_ref' in text:value=self.rows
            elif 'has_schema_privilege(current_user' in text:value=self.forbidden
            elif 'FROM pg_policies' in text:value=self.policies
            else:raise AssertionError('Consulta no esperada')
            return MarcaPrivada112F.Result(value)

    def test_control_lectura_valido_y_sin_configuraciones_del_servidor(self):
        c=self.Connection();qa.verificar_marca(c)
        self.assertEqual(len(c.queries),5)
        self.assertTrue(all('grocio.qa_project' not in s for s in c.queries))

    def test_host_y_tls_rechazados_antes_de_consultar(self):
        for field,value in [('host','db.dkfpgvxjnsvlphiakpps.supabase.co'),
                            ('host','db.sygfauunjvhaoyczdhuu.supabase.co'),
                            ('dbname','otra'),('user','postgres'),('port',5433)]:
            c=self.Connection();setattr(c.driver.info,field,value)
            with self.subTest(field=field,value=value),self.assertRaises(qa.QANoPreparado):qa.verificar_marca(c)
            self.assertFalse(c.queries)
        c=self.Connection();c.driver.pgconn.ssl_in_use=False
        with self.assertRaises(qa.QANoPreparado):qa.verificar_marca(c)
        self.assertFalse(c.queries)

    def test_pooler_oficial_exige_sufijo_qa2(self):
        c=self.Connection();c.driver.info.host='aws-1-us-west-2.pooler.supabase.com'
        c.driver.info.user=f'soporte_ti_api.{qa.PROJECT}';c.driver.info.port=6543
        qa.verificar_marca(c)
        c=self.Connection();c.driver.info.host='aws-1-us-west-2.pooler.supabase.com'
        with self.assertRaises(qa.QANoPreparado):qa.verificar_marca(c)

    def test_identidad_sesion_no_puede_falsearse_con_la_marca(self):
        for identity in [('otra','soporte_ti_api','on'),('postgres','postgres','on'),('postgres','soporte_ti_api','off')]:
            c=self.Connection();c.identity=identity
            with self.subTest(identity=identity),self.assertRaises(qa.QANoPreparado):qa.verificar_marca(c)

    def test_propietario_rls_y_tipo_protegidos(self):
        for control in [None,('postgres','soporte_ti_api','r',True,False),
                        ('anon','postgres','r',True,False),('postgres','postgres','v',True,False),
                        ('postgres','postgres','r',False,False),('postgres','postgres','r',True,True)]:
            c=self.Connection();c.control=control
            with self.subTest(control=control),self.assertRaises(qa.QANoPreparado):qa.verificar_marca(c)

    def test_marca_ausente_multiple_y_ajena_rechazadas(self):
        for rows in [[],self.Connection().rows*2,
                     [('dkfpgvxjnsvlphiakpps',qa.ORIGIN,qa.PROJECT_NAME,'postgres',1,'postgres')],
                     [(qa.PROJECT,qa.ORIGIN,qa.PROJECT_NAME,'postgres',2,'postgres')]]:
            c=self.Connection();c.rows=rows
            with self.subTest(rows=rows),self.assertRaises(qa.QANoPreparado):qa.verificar_marca(c)

    def test_api_sin_escritura_y_clientes_sin_acceso(self):
        for index in range(6):
            c=self.Connection();values=[False]*6;values[index]=True;c.forbidden=tuple(values)
            with self.subTest(index=index),self.assertRaises(qa.QANoPreparado):qa.verificar_marca(c)

    def test_politica_adicional_o_permisiva_para_otro_rol_rechazada(self):
        for policies in [[],self.Connection().policies*2,
                         [('ALL',['soporte_ti_api'],'singleton',None,'PERMISSIVE')],
                         [('SELECT',['authenticated'],'singleton',None,'PERMISSIVE')],
                         [('SELECT',['soporte_ti_api'],'true',None,'PERMISSIVE')]]:
            c=self.Connection();c.policies=policies
            with self.subTest(policies=policies),self.assertRaises(qa.QANoPreparado):qa.verificar_marca(c)

    def test_sql_nuevo_sin_parametros_restringidos_y_escritura_guardada(self):
        from pglast import parse_sql,parse_plpgsql
        repo=Path(__file__).resolve().parents[2]
        file=repo/'database/qa/00b_qa2_control_revision.sql'
        source=file.read_text(encoding='utf-8')
        self.assertNotIn('ALTER DATABASE',source)
        self.assertNotIn('grocio.qa_project',source)
        self.assertIn('v_aplicar boolean := false;',source)
        self.assertIn('v_destino_externo_verificado boolean := false;',source)
        self.assertTrue(parse_sql(source))
        parsed=parse_plpgsql(source)
        self.assertTrue(parsed)
        writes=[]
        def guarded_statements(node,protected=False):
            if isinstance(node,list):
                for item in node:guarded_statements(item,protected)
            elif isinstance(node,dict):
                for kind,body in node.items():
                    if kind=='PLpgSQL_stmt_if':
                        condition=body['cond']['PLpgSQL_expr']['query'].strip()
                        guarded_statements(body.get('then_body',[]),protected or condition=='v_aplicar')
                        guarded_statements(body.get('else_body',[]),protected)
                        self.assertFalse(body.get('elsif_list'))
                    elif kind=='PLpgSQL_stmt_execsql':
                        query=body['sqlstmt']['PLpgSQL_expr']['query'].lstrip()
                        if query.split()[0].upper() in {'CREATE','ALTER','GRANT','REVOKE','INSERT','UPDATE','DELETE','DROP'}:
                            self.assertTrue(protected,'Escritura fuera de v_aplicar: '+query.split()[0])
                            writes.append(query.split()[0])
                    elif kind=='PLpgSQL_stmt_dynexecute':
                        self.fail('SQL dinamico no admitido en el nuevo bootstrap')
                    else:guarded_statements(body,protected)
        guarded_statements(parsed)
        self.assertGreaterEqual(len(writes),10)
        for name in ['112f_perfiles_ficticios_revision.sql','112f_storage_privado_revision.sql']:
            text=(repo/'database/qa'/name).read_text(encoding='utf-8')
            self.assertNotIn('grocio.qa_project',text)
            self.assertIn('qa_control.entorno',text)
            self.assertTrue(parse_plpgsql(text))
        checks=parse_sql((repo/'database/qa/00c_qa2_verificar_control_solo_lectura.sql').read_text(encoding='utf-8'))
        self.assertTrue(all(type(x.stmt).__name__ in {'SelectStmt','TransactionStmt'} for x in checks))

if __name__=='__main__':unittest.main()
