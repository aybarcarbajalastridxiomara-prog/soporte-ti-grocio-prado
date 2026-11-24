"""Contratos simulados: nunca envían correos ni archivos a servicios externos."""
import os,json,unittest
from dataclasses import replace
from unittest.mock import patch
from uuid import uuid4
os.environ.update(PYTHON_DOTENV_DISABLED='1',DATABASE_URL='',SUPABASE_URL='')
from fastapi import HTTPException
from app.config import get_settings
from app.adjuntos import validar_archivo,MAX_BYTES,StoragePrivado,limites_storage
from app.servicios_privados import origen_supabase,peticion_privada,cabeceras_supabase
from app.notificaciones import plantilla,plantilla_html,contenido_evento,enviar_brevo,validar_brevo_sandbox,ESTADOS
from app.supabase_admin import invitar_en_supabase
from app.notificaciones import resolver_correo

class Complementos112E(unittest.TestCase):
    def test_cabeceras_privadas_conservan_legacy_y_rechazan_publicas_o_controles(self):
        self.assertEqual(cabeceras_supabase('ficticia-no-operativa'),{'apikey':'ficticia-no-operativa','Authorization':'Bearer ficticia-no-operativa'})
        for clave in ['','sb_publishable_qa_no_operativa','privada\nsegunda-linea','privada con espacio']:
            with self.subTest(),self.assertRaises(HTTPException) as error:cabeceras_supabase(clave)
            self.assertNotIn('segunda-linea',error.exception.detail)
    def test_nueva_clave_opaca_no_se_presenta_como_jwt_al_invitar(self):
        settings=replace(get_settings(),supabase_service_role_key='sb_secret_qa_no_operativa',supabase_url='https://qa-ficticio.supabase.co')
        with patch('app.supabase_admin.get_settings',return_value=settings),patch('app.supabase_admin.peticion_privada',return_value=(200,b'{}')) as request:
            invitar_en_supabase('prueba@example.invalid')
            self.assertTrue('Authorization' not in request.call_args.kwargs['headers'],'La clave opaca solo debe ir en apikey, nunca como JWT.')

    def test_nueva_clave_opaca_no_se_presenta_como_jwt_en_storage_y_destinatarios(self):
        settings=replace(get_settings(),adjuntos_habilitados=True,adjuntos_bucket='incidencias-qa',supabase_service_role_key='sb_secret_qa_no_operativa',supabase_url='https://qa-ficticio.supabase.co')
        with patch('app.adjuntos.get_settings',return_value=settings),patch('app.adjuntos.peticion_privada',return_value=(200,b'{"id":"incidencias-qa","public":false}')) as request:
            StoragePrivado().verificar_privacidad()
            self.assertTrue('Authorization' not in request.call_args.kwargs['headers'],'Storage no debe recibir una clave opaca como JWT.')
        id_=uuid4()
        with patch('app.notificaciones.get_settings',return_value=settings),patch('app.notificaciones.peticion_privada',return_value=(200,json.dumps({'id':str(id_),'email':'prueba@example.invalid','email_confirmed_at':'2026-11-23'}).encode())) as request:
            self.assertEqual(resolver_correo(id_),'prueba@example.invalid')
            self.assertTrue('Authorization' not in request.call_args.kwargs['headers'],'La consulta privada Auth no debe recibir una clave opaca como JWT.')

    def test_credencial_mal_copiada_no_se_incluye_en_error_ni_sale_a_red(self):
        with patch('app.servicios_privados.build_opener') as network:
            with self.assertRaises(HTTPException) as caught:
                peticion_privada('https://api.brevo.com/v3/smtp/email',headers={'api-key':'ficticia-no-operativa\nsegunda-linea'})
            self.assertNotIn('ficticia',caught.exception.detail)
            network.assert_not_called()
        with self.assertRaises(HTTPException):origen_supabase('https://qa.supabase.co:invalido')
    def test_tipos_extensiones_limites_y_nombres(self):
        validos=[('prueba.pdf','application/pdf',b'%PDF-1.4\nQA ficticio\n%%EOF'),('prueba.png','image/png',b'\x89PNG\r\n\x1a\nQA'),('prueba.jpg','image/jpeg',b'\xff\xd8\xffQA'),('prueba.webp','image/webp',b'RIFF0000WEBPQA')]
        for args in validos:validar_archivo(*args)
        for args in [('..\\otro.pdf','application/pdf',validos[0][2]),('a.html','text/html',b'<html>'),('a.pdf','application/pdf',b'no pdf'),('a.png','image/png',b'x'*(MAX_BYTES+1)),('a.pdf\r\nX','application/pdf',validos[0][2])]:
            with self.subTest(args=args[:2]),self.assertRaises(HTTPException):validar_archivo(*args)
    def test_destinos_privados_y_bucket_publico_rechazados(self):
        for url in ['http://proyecto.supabase.co','https://otro.invalid','https://p.supabase.co@otro.invalid','https://p.supabase.co/ruta']:
            with self.assertRaises(HTTPException):origen_supabase(url)
        settings=replace(get_settings(),adjuntos_habilitados=True,adjuntos_bucket='evidencias',supabase_service_role_key='ficticia-no-operativa',supabase_url='https://qa-ficticio.supabase.co')
        with patch('app.adjuntos.get_settings',return_value=settings),patch('app.adjuntos.peticion_privada',return_value=(200,b'{"id":"evidencias","public":true}')) as request:
            with self.assertRaises(HTTPException):StoragePrivado().guardar(str(uuid4())+'/'+uuid4().hex,'application/pdf',b'qa')
            self.assertEqual(request.call_count,1)
    def test_plantillas_minimas_y_correo_deshabilitado(self):
        for accion in ESTADOS:
            subject,body=plantilla({'accion':accion,'codigo':'QA-112E','asunto':'Caso ficticio','ciclo':2})
            self.assertIn('QA-112E',subject);self.assertIn('Municipalidad Distrital',body);self.assertIn('Ciclo: 2',body)
            self.assertNotIn('password',body)
        with patch('app.notificaciones.peticion_privada') as request:
            with self.assertRaises(HTTPException):enviar_brevo(uuid4(),'destino@example.invalid',{})
            request.assert_not_called()

    def test_bucket_qa_excluye_webp_y_respeta_limite_menor_sin_subir(self):
        meta={'id':'incidencias-qa','public':False,'allowed_mime_types':['application/pdf','image/jpeg','image/png'],'file_size_limit':5_242_880}
        tipos,limite=limites_storage(meta)
        self.assertNotIn('image/webp',tipos);self.assertEqual(limite,MAX_BYTES)
        settings=replace(get_settings(),adjuntos_habilitados=True,adjuntos_bucket='incidencias-qa',supabase_service_role_key='ficticia-no-operativa',supabase_url='https://qa-ficticio.supabase.co')
        with patch('app.adjuntos.get_settings',return_value=settings),patch('app.adjuntos.peticion_privada',return_value=(200,json.dumps(meta).encode())) as request:
            with self.assertRaises(HTTPException) as error:StoragePrivado().guardar(str(uuid4())+'/'+uuid4().hex,'image/webp',b'RIFF0000WEBPQA')
            self.assertEqual(error.exception.status_code,422);self.assertEqual(request.call_count,1)
            meta['file_size_limit']=10;request.return_value=(200,json.dumps(meta).encode())
            with self.assertRaises(HTTPException) as error:StoragePrivado().guardar(str(uuid4())+'/'+uuid4().hex,'application/pdf',b'x'*11)
            self.assertEqual(error.exception.status_code,413);self.assertEqual(request.call_count,2)
        for bad in [{'allowed_mime_types':'image/png'},{'file_size_limit':True},{'file_size_limit':0}]:
            with self.assertRaises(HTTPException):limites_storage(bad)
    def test_brevo_reutiliza_uuid_y_no_propaga_error_privado(self):
        settings=replace(get_settings(),brevo_habilitado=True,brevo_api_key='ficticia-no-operativa',correo_remitente='qa@example.invalid')
        id_=uuid4();data={'accion':'CIERRE','codigo':'QA-112E','asunto':'Ficticio','ciclo':1}
        with patch('app.notificaciones.get_settings',return_value=settings),patch('app.notificaciones.peticion_privada',return_value=(201,b'{}')) as request:
            self.assertEqual(enviar_brevo(id_,'destino@example.invalid',data),'enviado')
            payload=json.loads(request.call_args.kwargs['data']);self.assertEqual(payload['headers']['idempotencyKey'],str(id_))
            self.assertIn('htmlContent',payload);self.assertIn('textContent',payload)
            self.assertNotIn('X-Sib-Sandbox',payload['headers'])
            self.assertEqual(request.call_args.args[0],'https://api.brevo.com/v3/smtp/email')
            request.return_value=(500,b'');self.assertEqual(enviar_brevo(id_,'destino@example.invalid',data),'incierto')
            request.return_value=(400,b'duplicate_parameter');self.assertEqual(enviar_brevo(id_,'destino@example.invalid',data),'enviado')

    def test_html_escapa_datos_y_asunto_rechaza_inyeccion_de_cabeceras(self):
        for accion in ESTADOS:
            datos={'accion':accion,'codigo':'QA\r\nBcc: otro','asunto':'<script>alert("x")</script>& privado','ciclo':2}
            subject,plain=plantilla(datos);html=plantilla_html(datos)
            self.assertNotIn('\r',subject);self.assertNotIn('\n',subject)
            self.assertIn('&lt;script&gt;',html);self.assertNotIn('<script>',html)
            self.assertIn('lang="es"',html);self.assertIn('scope="row"',html)
            self.assertNotIn('http',html);self.assertIn('Ciclo: 2',plain)

    def test_prioridad_del_evento_no_se_confunde_con_oficial(self):
        base={'codigo':'QA-112F','asunto':'Ficticio','ciclo':2}
        for provisional in (True,False):
            row={**base,'accion':'PRIORIDAD_PROVISIONAL' if provisional else 'PRIORIDAD_CONFIRMADA',
                'descripcion':json.dumps({'ciclo':2,'rol_actor':'ASISTENTE' if provisional else 'JEFE',
                    'anterior':None,'nueva':'Alta','justificacion':'No copiar este motivo privado',
                    'impacto':'Si','provisional':provisional})}
            data=contenido_evento(row);self.assertEqual(data['prioridad'],'Alta')
            self.assertNotIn('justificacion',data)
            _,plain=plantilla(data)
            self.assertIn('Propuesta (no oficial): Alta' if provisional else 'Prioridad oficial: Alta',plain)
            row['ciclo']=3;self.assertNotIn('prioridad',contenido_evento(row))
            row['descripcion']='Evento legado';self.assertNotIn('prioridad',contenido_evento(row))

    def test_observacion_no_inventa_el_estado_vigente_ni_una_solucion(self):
        _,plain=plantilla({'accion':'OBSERVACION','codigo':'QA-112F','asunto':'Ficticio','ciclo':1})
        self.assertIn('Consultar el ciclo vigente',plain);self.assertNotIn('Estado del evento: Cerrado',plain)
        # SOLUCION es una etiqueta de notificación derivada de una intervención
        # final inequívoca; nunca un nuevo endpoint ni un cambio de estado.
        self.assertIn('SOLUCION',ESTADOS);self.assertNotIn('INTERVENCION',ESTADOS)

    def test_sandbox_oficial_no_consume_cola_ni_declara_entrega(self):
        settings=replace(get_settings(),brevo_habilitado=False,brevo_api_key='ficticia-no-operativa',correo_remitente='qa@example.invalid')
        with patch('app.notificaciones.get_settings',return_value=settings),patch('app.notificaciones.peticion_privada',return_value=(201,b'{"messageId":"no-entrega"}')) as request:
            self.assertEqual(validar_brevo_sandbox(),{'validado_sandbox':True,'correos_enviados':0})
            payload=json.loads(request.call_args.kwargs['data'])
            self.assertEqual(payload['headers']['X-Sib-Sandbox'],'drop')
            self.assertEqual(payload['to'],[{'email':'prueba@example.invalid'}])
            self.assertNotIn('messageId',str(validar_brevo_sandbox()))
            request.return_value=(500,b'privado')
            with self.assertRaises(HTTPException) as error:validar_brevo_sandbox()
            self.assertNotIn('privado',error.exception.detail)

if __name__=='__main__':unittest.main()
