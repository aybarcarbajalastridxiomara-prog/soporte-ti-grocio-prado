"""Reportes sobre PostgreSQL QA nuevo y marcado. Requiere pypdf de pruebas.

Reutiliza exclusivamente el fixture 112C local; --puerto no acepta host/DSN.
No usa Supabase Auth, servicios municipales, migraciones ni tablas existentes.
"""
import argparse
import importlib.util
import json
import sys
import unittest
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlencode
from uuid import UUID, uuid4

spec = importlib.util.spec_from_file_location("fixtures112c", Path(__file__).with_name("probar_funcional_112c.py"))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)

from openpyxl import load_workbook
from pypdf import PdfReader
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.reportes import MAX_FILAS_EXPORTACION, MUNICIPALIDAD
from app.routes import reportes as rutas


class ReportesPostgres(fixture.FuncionesV3):
    def muchos(self, numero, *, fecha=None, prioridad=None, estado="Pendiente", asunto="Incidencia ficticia de reportes"):
        ids = [uuid4() for _ in range(numero)]
        with fixture.admin(self.database) as db, db.cursor() as cursor:
            cursor.executemany("""INSERT INTO public.incidencias
                (id, area_id, reportante_id, asunto, descripcion, estado, prioridad, fecha_registro,
                 fecha_cierre, cerrado_por_usuario_id)
                VALUES (%s,%s,%s,%s,'Solo QA local',%s,%s,%s,%s,%s)""",
                [(id_, self.area, self.ids["REPRESENTANTE"], asunto, estado, prioridad,
                    fecha or datetime(2026, 11, 18, 12, tzinfo=timezone.utc),
                    datetime(2026, 11, 19, 12, tzinfo=timezone.utc) if estado == "Cerrado" else None,
                    self.ids["ASISTENTE"] if estado == "Cerrado" else None) for id_ in ids])
        return ids

    def reporte(self, role="JEFE", **parametros):
        return self.request(role, "GET", "/api/reportes/incidencias?" + urlencode({"area_id": str(self.area), **parametros}))

    def archivo(self, formato="xlsx", role="JEFE", **parametros):
        return self.request(role, "GET", "/api/reportes/incidencias/exportar?" + urlencode({"area_id": str(self.area), "formato": formato, **parametros}))

    def test_reportes_permisos_en_consulta_catalogos_y_ambas_descargas(self):
        for role in ("REPRESENTANTE", "ASISTENTE", "PRACTICANTE", "OTRO_REP"):
            with patch.object(rutas, "generar_pdf") as pdf, patch.object(rutas, "generar_excel") as xlsx:
                self.assertEqual(self.reporte(role).status_code, 403)
                for formato in ("pdf", "xlsx"):
                    self.assertEqual(self.archivo(formato, role).status_code, 403)
                self.assertEqual(self.request(role, "GET", "/api/reportes/catalogos").status_code, 403)
                pdf.assert_not_called(); xlsx.assert_not_called()
        with fixture.admin(self.database) as db:
            db.execute("UPDATE public.usuarios SET habilitado=false WHERE id=%s", (self.ids["JEFE"],))
        self.assertEqual(self.reporte().status_code, 403)
        self.assertEqual(self.archivo().status_code, 403)
        fixture.app.dependency_overrides.pop(fixture.get_identity)
        for url in ("/api/reportes/catalogos", "/api/reportes/incidencias", "/api/reportes/incidencias/exportar?formato=pdf", "/api/reportes/incidencias/exportar?formato=xlsx"):
            self.assertEqual(self.client.get(url).status_code, 401)

    def test_reportes_paginacion_mas_de_cien_sin_duplicados_ni_totales_parciales(self):
        ids = set(map(str, self.muchos(237)))
        vistos = []
        for pagina in range(1, 4):
            r = self.reporte(pagina=pagina, tamano_pagina=100)
            self.assertEqual(r.status_code, 200, r.text)
            datos = r.json()
            self.assertEqual(datos["resumen"]["total"], 237)
            self.assertEqual(datos["total_paginas"], 3)
            for grupos in datos["desgloses"].values():
                self.assertEqual(sum(g["total"] for g in grupos), 237)
            vistos.extend(f["id"] for f in datos["incidencias"])
        self.assertEqual(len(vistos), 237)
        self.assertEqual(set(vistos), ids)
        self.assertEqual(self.reporte(pagina=4, tamano_pagina=100).json()["incidencias"], [])
        xlsx = self.archivo()
        self.assertEqual(xlsx.status_code, 200, xlsx.text[:200] if xlsx.status_code != 200 else "")
        libro = load_workbook(BytesIO(xlsx.content))
        self.assertEqual(libro["Incidencias"].max_row, 237 + 7)
        self.assertEqual(libro["Incidencias"].freeze_panes, "A8")
        self.assertEqual(libro["Incidencias"].auto_filter.ref, "A7:H244")
        libro.close()

    def test_reportes_filtros_combinados_prioridad_oficial_null_y_legados(self):
        alta = self.muchos(3, prioridad="Alta")
        self.muchos(2, prioridad="Media")
        self.muchos(1, prioridad="Baja", estado="Cerrado")
        self.muchos(2, prioridad=None)
        self.muchos(1, prioridad="Legada")
        id_ = self.crear()
        self.assertEqual(self.tomar(id_).status_code, 201)
        self.assertEqual(self.prioridad(id_, "ASISTENTE").status_code, 201)
        self.assertEqual(self.reporte(prioridad="Alta").json()["resumen"]["total"], 3)
        self.assertEqual(self.reporte(prioridad="sin_evaluar").json()["resumen"]["total"], 3)
        self.assertEqual(self.reporte(prioridad="no_clasificada").json()["resumen"]["total"], 1)
        self.assertEqual(self.reporte(estado="Cerrado", prioridad="Baja", responsable_id=str(self.ids["ASISTENTE"])).json()["resumen"]["total"], 1)
        self.assertEqual(self.reporte(prioridad="Alta", responsable_id="sin_responsable").json()["resumen"]["total"], len(alta))
        self.assertEqual(self.reporte(responsable_id=str(self.ids["ASISTENTE"])).json()["resumen"]["total"], 2)
        self.assertEqual(self.reporte(prioridad="Alta", estado="Cerrado").json()["resumen"]["total"], 0)
        self.assertEqual(self.reporte(area_id=str(self.otra_area)).json()["resumen"]["total"], 0)

    def test_reportes_fechas_inclusivas_en_lima_no_en_utc(self):
        for iso in ("2026-11-18T04:59:59+00:00", "2026-11-18T05:00:00+00:00", "2026-11-19T04:59:59+00:00", "2026-11-19T05:00:00+00:00"):
            self.muchos(1, fecha=datetime.fromisoformat(iso))
        r = self.reporte(desde="2026-11-18", hasta="2026-11-18")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["resumen"]["total"], 2)
        libro = load_workbook(BytesIO(self.archivo(desde="2026-11-18", hasta="2026-11-18").content))
        self.assertEqual(libro["Incidencias"]["E8"].value.day, 18)
        self.assertEqual(libro["Incidencias"]["E9"].value.hour, 0)
        libro.close()

    def test_reportes_validacion_y_errores_no_producen_archivos(self):
        for p in ({"desde": "2026-11-19", "hasta": "2026-11-18"}, {"pagina": 0}, {"tamano_pagina": 101},
            {"area_id": str(uuid4())}, {"responsable_id": str(uuid4())}, {"area_id": "no-es-uuid"},
            {"prioridad": "Urgente"}, {"estado": "Inexistente"}, {"actor_id": str(self.ids["JEFE"])}):
            with self.subTest(p=p):
                r = self.reporte(**p)
                self.assertEqual(r.status_code, 422, r.text)
        self.assertEqual(self.archivo("csv").status_code, 422)
        self.assertEqual(self.archivo(pagina=1).status_code, 422)
        with patch.object(rutas, "generar_pdf", side_effect=RuntimeError("dato privado que no debe salir")):
            r = self.archivo("pdf")
            self.assertEqual(r.status_code, 503)
            self.assertNotIn("privado", r.text)
        with patch.object(rutas, "formatos_disponibles", return_value=[]):
            self.assertEqual(self.archivo().status_code, 503)
            self.assertEqual(self.reporte().json()["exportacion"]["formatos"], [])
        with patch.object(rutas, "preparar_base", side_effect=SQLAlchemyError("detalle privado de conexión")):
            for r in (self.reporte(), self.archivo()):
                self.assertEqual(r.status_code, 503)
                self.assertNotIn("privado", r.text)
        self.assertEqual(self.reporte().status_code, 200)  # La conexión fallida no queda contaminada.

    def test_reportes_archivos_vacios_validos_y_encabezados_privados(self):
        for formato in ("pdf", "xlsx"):
            r = self.archivo(formato)
            self.assertEqual(r.status_code, 200, r.text[:200] if r.status_code != 200 else "")
            self.assertEqual(r.headers["cache-control"], "no-store")
            self.assertEqual(r.headers["x-content-type-options"], "nosniff")
            self.assertIn("attachment; filename=", r.headers["content-disposition"])
            if formato == "pdf":
                lector = PdfReader(BytesIO(r.content))
                texto = "\n".join(p.extract_text() for p in lector.pages)
                self.assertIn(MUNICIPALIDAD.upper(), texto)
                self.assertIn("No existen incidencias", texto)
                self.assertRegex(texto, r"\b0\s+Registradas\b")
                self.assertIn("(Lima)", texto)
            else:
                libro = load_workbook(BytesIO(r.content))
                self.assertEqual(libro.sheetnames, ["Resumen", "Filtros", "Incidencias"])
                self.assertEqual(libro["Incidencias"].max_row, 7)
                self.assertEqual([c.value for c in libro["Incidencias"][7]],
                    ["N.º", "Código", "Asunto", "Área municipal", "Fecha de registro", "Prioridad oficial", "Estado", "Responsable"])
                self.assertEqual(libro["Resumen"]["A8"].value, 0)
                self.assertEqual(libro["Filtros"]["A8"].value, "Fecha de registro")
                libro.close()

    def test_reportes_responsables_historicos_inhabilitados_y_sin_duplicaciones(self):
        id_ = self.crear()
        self.assertEqual(self.tomar(id_, "JEFE").status_code, 201)
        self.assertEqual(self.reporte(responsable_id=str(self.ids["JEFE"])).json()["resumen"]["total"], 1)
        cerrada = self.muchos(1, estado="Cerrado")[0]
        with fixture.admin(self.database) as db:
            db.execute("UPDATE public.usuarios SET habilitado=false WHERE id=%s", (self.ids["ASISTENTE"],))
            for _ in range(3):
                db.execute("""INSERT INTO public.asignaciones(incidencia_id,tecnico_id,asignado_por_id,origen_asignacion,fecha_fin)
                    VALUES (%s,%s,%s,'JEFATURA',now())""", (cerrada, self.ids["ASISTENTE"], self.ids["JEFE"]))
        r = self.reporte()
        self.assertEqual(r.json()["resumen"]["total"], 2)
        self.assertEqual(self.reporte(responsable_id=str(self.ids["ASISTENTE"])).json()["resumen"]["total"], 1)
        catalogos = self.request("JEFE", "GET", "/api/reportes/catalogos").json()
        self.assertTrue(any(u["id"] == str(self.ids["ASISTENTE"]) and not u["habilitado"] for u in catalogos["responsables"]))
        self.assertFalse(any(u["id"] == str(self.ids["REPRESENTANTE"]) for u in catalogos["responsables"]))

    def test_reportes_instantanea_coherente_y_transaccion_sin_escrituras(self):
        self.muchos(2)
        original = rutas.resumen_y_desgloses
        transaccion = {}

        def concurrente(db, base):
            transaccion["solo_lectura"] = db.execute(text("SHOW transaction_read_only")).scalar_one()
            transaccion["aislamiento"] = db.execute(text("SHOW transaction_isolation")).scalar_one()
            resultado = original(db, base)
            self.muchos(1)  # Otra conexión, después del resumen y antes de cargar la página.
            return resultado

        with patch.object(rutas, "resumen_y_desgloses", side_effect=concurrente):
            r = self.reporte()
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(transaccion, {"solo_lectura": "on", "aislamiento": "repeatable read"})
        self.assertEqual(r.json()["resumen"]["total"], 2)
        self.assertEqual(len(r.json()["incidencias"]), 2)
        self.assertEqual(self.reporte().json()["resumen"]["total"], 3)
        # La conexión se devuelve limpia: las escrituras técnicas posteriores siguen permitidas.
        self.assertTrue(self.crear())

    def test_reportes_volumen_maximo_real_y_rechazo_explicito_sin_truncar(self):
        self.muchos(MAX_FILAS_EXPORTACION)
        for formato in ("pdf", "xlsx"):
            r = self.archivo(formato)
            self.assertEqual(r.status_code, 200, r.text[:300] if r.status_code != 200 else "")
            self.assertLess(len(r.content), 4_000_000)
            if formato == "xlsx":
                libro = load_workbook(BytesIO(r.content), read_only=True)
                self.assertEqual(libro["Incidencias"].max_row, MAX_FILAS_EXPORTACION + 7)
                libro.close()
            else:
                lector = PdfReader(BytesIO(r.content))
                self.assertGreater(len(lector.pages), 1)
                self.assertIn("Código", lector.pages[1].extract_text())
        self.muchos(1)
        with patch.object(rutas, "generar_pdf") as generador:
            self.assertEqual(self.archivo("pdf").status_code, 422)
            generador.assert_not_called()
        self.assertEqual(self.archivo().status_code, 422)
        self.assertEqual(self.reporte().json()["resumen"]["total"], MAX_FILAS_EXPORTACION + 1)
        with patch.object(rutas, "MAX_FILAS_EXPORTACION", MAX_FILAS_EXPORTACION + 1), patch.object(rutas, "MAX_BYTES_EXPORTACION", 10):
            r = self.archivo()
            self.assertEqual(r.status_code, 422)
            self.assertIn("tamaño", r.json()["detail"])

    def test_reportes_texto_unicode_filtros_y_prioridad_provisional_en_archivos(self):
        self.muchos(1, asunto='=HYPERLINK("https://externo.invalid","ñ <Área> & revisión")')
        r = self.archivo("pdf")
        self.assertEqual(r.status_code, 200, r.text[:200] if r.status_code != 200 else "")
        texto = "\n".join(p.extract_text() for p in PdfReader(BytesIO(r.content)).pages)
        self.assertIn("ñ <Área> & revisión", " ".join(texto.split()))
        self.assertIn("Prioridad oficial", texto)
        id_ = self.crear()
        self.assertEqual(self.tomar(id_).status_code, 201)
        self.assertEqual(self.prioridad(id_, "ASISTENTE").status_code, 201)
        xlsx = self.archivo()
        libro = load_workbook(BytesIO(xlsx.content))
        asuntos = [libro["Incidencias"].cell(i, 3) for i in range(8, 10)]
        self.assertTrue(all(c.data_type == "s" and c.hyperlink is None for c in asuntos))
        valores = [libro["Incidencias"].cell(i, 6).value for i in range(8, 10)]
        self.assertTrue(any("provisional: Alta" in v for v in valores))
        libro.close()

    def test_reportes_borrador_tecnico_autorizado_no_otorga_descarga_institucional(self):
        for role in ("ASISTENTE", "PRACTICANTE"):
            id_ = self.crear()
            self.cerrar(id_, role)
            r = self.request(role, "GET", f"/api/incidencias/{id_}/informe-tecnico/borrador")
            self.assertEqual(r.status_code, 200, r.text)
            self.assertEqual(self.archivo("pdf", role).status_code, 403)
            tercero = "PRACTICANTE" if role == "ASISTENTE" else "ASISTENTE"
            self.assertEqual(self.request(tercero, "GET", f"/api/incidencias/{id_}/informe-tecnico/borrador").status_code, 403)


class ReportesV4(ReportesPostgres):
    v4 = True

    def test_reportes_ciclo_reabierto_solo_responsable_vigente_historial_intacto(self):
        id_, _ = fixture.FuncionesV4.reabierta(self)
        self.assertEqual(self.request("PRACTICANTE", "POST", f"/api/v4/incidencias/{id_}/tomar", {"ciclo_actual": 2}).status_code, 201)
        anterior = self.fila("SELECT count(*) AS n FROM public.historial_incidencias WHERE incidencia_id=:id", id=UUID(id_))["n"]
        responsable = self.reporte(responsable_id=str(self.ids["PRACTICANTE"])).json()
        self.assertEqual(responsable["resumen"]["total"], 1)
        self.assertEqual(responsable["incidencias"][0]["responsable_id"], str(self.ids["PRACTICANTE"]))
        self.assertEqual(self.reporte(responsable_id=str(self.ids["ASISTENTE"])).json()["resumen"]["total"], 0)
        self.assertEqual(self.archivo("pdf").status_code, 200)
        self.assertEqual(self.fila("SELECT count(*) AS n FROM public.historial_incidencias WHERE incidencia_id=:id", id=UUID(id_))["n"], anterior)
        self.assertEqual(self.fila("SELECT estado,ciclo_actual FROM public.incidencias WHERE id=:id", id=UUID(id_)), {"estado": "En revisión", "ciclo_actual": 2})


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--puerto", type=int, required=True)
    args = parser.parse_args()
    if not 1024 < args.puerto < 65536:
        raise SystemExit("Puerto local no válido")
    fixture.PORT = args.puerto
    with fixture.admin():
        pass
    pruebas = unittest.TestSuite()
    for clase in (ReportesPostgres, ReportesV4):
        for nombre in unittest.defaultTestLoader.getTestCaseNames(clase):
            if nombre.startswith("test_reportes_"):
                pruebas.addTest(clase(nombre))
    resultado = unittest.TextTestRunner(verbosity=2).run(pruebas)
    raise SystemExit(not resultado.wasSuccessful())
