"""Límites adicionales del worker QA. Sin red ni base de datos remota."""
import os, unittest
from datetime import datetime, timezone
from uuid import uuid4
from unittest.mock import MagicMock, patch
from dataclasses import replace
os.environ['PYTHON_DOTENV_DISABLED']='1'
from app.config import get_settings
from app.notificaciones import AlcanceNotificaciones, preparar, procesar_uno

class AlcanceQA2(unittest.TestCase):
    def setUp(self):
        self.persona=uuid4();self.otro=uuid4();self.ticket=uuid4()
        self.fecha=datetime(2026,11,26,tzinfo=timezone.utc)
        self.scope=AlcanceNotificaciones(frozenset([self.persona]),frozenset([self.ticket]),self.fecha)

    def test_rechaza_vacios_fechas_sin_zona_y_valores_que_no_son_uuid(self):
        for users,tickets,date in [([], [self.ticket],self.fecha),([self.persona],[],self.fecha),([self.persona],[self.ticket],datetime(2026,11,26)),(['x'],[self.ticket],self.fecha),([uuid4() for _ in range(7)],[self.ticket],self.fecha)]:
            with self.subTest(),self.assertRaises(ValueError):AlcanceNotificaciones(frozenset(users),frozenset(tickets),date)

    def test_filtros_parametrizados_sin_publicar_identificadores(self):
        sql,params=self.scope.filtros(destinatario='n')
        self.assertIn('n.destinatario_id IN (:qa_u0)',sql)
        self.assertIn('i.reportante_id IN (:qa_u0)',sql)
        self.assertIn('i.id IN (:qa_i0)',sql)
        self.assertNotIn(str(self.persona),sql)
        self.assertEqual(params['qa_desde'],self.fecha)

    def test_preparacion_excluye_jefes_anteriores_y_conserva_unique(self):
        db=MagicMock();res=MagicMock();db.execute.return_value=res
        res.mappings.return_value.all.return_value=[{'id':uuid4(),'accion':'CREACION','descripcion':'','fecha_registro':self.fecha,'ticket':self.ticket,'codigo':'FICTICIO','asunto':'Prueba','reportante_id':self.persona,'ciclo':1}]
        res.scalars.return_value=[self.persona,self.otro];res.rowcount=1
        self.assertEqual(preparar(db,self.fecha,alcance=self.scope),1)
        writes=[call for call in db.execute.call_args_list if 'INSERT INTO' in str(call.args[0])]
        self.assertEqual(len(writes),1)
        self.assertEqual(writes[0].args[1]['usuario'],self.persona)
        self.assertIn('ON CONFLICT(evento_id,destinatario_id) DO NOTHING',str(writes[0].args[0]))
        self.assertIn('i.id IN (:qa_i0)',str(db.execute.call_args_list[0].args[0]))

    def test_envio_y_recuperacion_de_enviando_quedan_acotados(self):
        db=MagicMock();db.execute.return_value.mappings.return_value.one_or_none.return_value=None
        settings=replace(get_settings(),brevo_habilitado=True)
        with patch('app.notificaciones.get_settings',return_value=settings):
            self.assertIsNone(procesar_uno(db,alcance=self.scope))
        for call in db.execute.call_args_list:
            sql=str(call.args[0]);self.assertIn('n.destinatario_id IN (:qa_u0)',sql)
            self.assertIn('i.id IN (:qa_i0)',sql);self.assertIn('h.fecha_registro>=:qa_desde',sql)
        self.assertIn('FOR UPDATE OF n SKIP LOCKED',str(db.execute.call_args_list[1].args[0]))

    def test_incierto_no_se_selecciona_para_reenvio(self):
        db=MagicMock();db.execute.return_value.mappings.return_value.one_or_none.return_value=None
        with patch('app.notificaciones.get_settings',return_value=replace(get_settings(),brevo_habilitado=True)):
            procesar_uno(db,alcance=self.scope)
        self.assertIn("n.estado='pendiente'",str(db.execute.call_args_list[1].args[0]))
        self.assertNotIn("n.estado='incierto'",str(db.execute.call_args_list[1].args[0]))

    def test_sin_alcance_preserva_contrato_del_worker_existente(self):
        db=MagicMock();db.execute.return_value.mappings.return_value.one_or_none.return_value=None
        with patch('app.notificaciones.get_settings',return_value=replace(get_settings(),brevo_habilitado=True)):
            procesar_uno(db)
        self.assertNotIn('qa_',str(db.execute.call_args_list[1].args[0]))

if __name__=='__main__':unittest.main()
