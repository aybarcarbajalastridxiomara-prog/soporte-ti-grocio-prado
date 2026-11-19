"""Contratos y archivos ficticios; no inicia conexiones ni carga .env."""
import os
import unittest
from datetime import datetime, timezone
from io import BytesIO
from zipfile import ZipFile

os.environ.update(DATABASE_URL="", SUPABASE_URL="", SUPABASE_SERVICE_ROLE_KEY="",
    PYTHON_DOTENV_DISABLED="1", APP_ENV="ci")

from openpyxl import load_workbook
from pydantic import ValidationError

from app.exportaciones_reportes import generar_excel, generar_pdf
from app.reportes import ConsultaReporte, ExportarReporte, filtros_solamente, MUNICIPALIDAD


def datos_ficticios(filas=None):
    return dict(organizacion=MUNICIPALIDAD, fecha_generacion=datetime(2026, 11, 18, 16, tzinfo=timezone.utc),
        periodo="2026-11-01 al 2026-11-18", filtros_aplicados={"Área municipal": "Área ficticia QA", "Estado": "Todos"},
        resumen=dict(total=len(filas or []), pendientes=len(filas or []), en_revision=0, cerradas=0),
        desgloses=dict(areas=[], prioridades=[], responsables=[]), incidencias=filas or [])


class ReportesContrato(unittest.TestCase):
    def test_fechas_paginacion_enum_y_campos_controlados(self):
        for campos in ({"desde": "2026-11-20", "hasta": "2026-11-18"}, {"hasta": "9999-12-31"},
            {"pagina": 0}, {"tamano_pagina": 101}, {"prioridad": "Urgente"}, {"estado": "Resuelto"},
            {"area_id": "invalido"}, {"rol": "JEFE"}, {"responsable_id": "cualquiera"}):
            with self.subTest(campos=campos), self.assertRaises(ValidationError):
                ConsultaReporte(**campos)

    def test_exportacion_no_admite_paginacion_ni_formatos_ficticios(self):
        for campos in ({"formato": "csv"}, {"formato": "xlsx", "pagina": 1}):
            with self.assertRaises(ValidationError):
                ExportarReporte(**campos)
        consulta = ConsultaReporte(desde="2026-11-01", pagina=3)
        self.assertNotIn("pagina", filtros_solamente(consulta).model_dump())

    def test_archivos_vacios_son_documentos_reales_con_cabeceras_y_ceros(self):
        datos = datos_ficticios()
        excel = generar_excel(datos)
        with ZipFile(BytesIO(excel)) as archivo:
            self.assertIn("xl/workbook.xml", archivo.namelist())
        libro = load_workbook(BytesIO(excel))
        self.assertEqual(libro["Incidencias"].max_row, 1)
        self.assertEqual(libro["Incidencias"]["A1"].value, "Código")
        self.assertEqual(libro["Resumen"]["A1"].value, MUNICIPALIDAD)
        self.assertEqual(libro["Resumen"]["B7"].value, 0)
        libro.close()
        pdf = generar_pdf(datos)
        self.assertTrue(pdf.startswith(b"%PDF-"))
        self.assertTrue(pdf.rstrip().endswith(b"%%EOF"))

    def test_excel_conserva_texto_literal_sin_formulas_enlaces_o_macros(self):
        filas = [dict(codigo=f"QA-{i}", asunto=texto, area_nombre="Área ficticia ñ",
            fecha_registro=datetime(2026, 11, 18, 5, tzinfo=timezone.utc), prioridad=None,
            prioridad_revision_pendiente=True, prioridad_provisional="Alta", estado="En revisión", responsable_nombre="Técnico ficticio")
            for i, texto in enumerate(['=HYPERLINK("https://externo.invalid","x")', "+SUM(1,2)", "@SUM(A1:A2)", "-1+2", "#REF!"])]
        excel = generar_excel(datos_ficticios(filas))
        libro = load_workbook(BytesIO(excel))
        for indice, fila in enumerate(filas, start=2):
            celda = libro["Incidencias"].cell(indice, 2)
            self.assertEqual(celda.value, fila["asunto"])
            self.assertEqual(celda.data_type, "s")
            self.assertIsNone(celda.hyperlink)
        self.assertEqual(libro["Incidencias"]["D2"].value.hour, 0)
        self.assertIn("provisional: Alta", libro["Incidencias"]["E2"].value)
        libro.close()
        with ZipFile(BytesIO(excel)) as archivo:
            self.assertFalse(any("vba" in n.lower() or "externallinks" in n.lower() for n in archivo.namelist()))
