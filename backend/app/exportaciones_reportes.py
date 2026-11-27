"""Archivos institucionales generados localmente, sin enlaces ni servicios externos."""
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from app.reportes import LIMA, MUNICIPALIDAD

CABECERAS = ["Código", "Asunto", "Área", "Registro", "Prioridad oficial", "Estado", "Responsable"]


def formatos_disponibles() -> list[str]:
    disponibles = []
    try:
        import openpyxl  # noqa: F401
        disponibles.append("xlsx")
    except (ImportError, OSError):
        pass
    try:
        fuentes_pdf()
        disponibles.append("pdf")
    except (ImportError, OSError):
        pass
    return disponibles


def fecha_local(fecha):
    return fecha.astimezone(LIMA).strftime("%d/%m/%Y %H:%M")


def valores_fila(fila: dict) -> list:
    prioridad = fila["prioridad"] or "Pendiente de evaluación"
    if not fila["prioridad"] and fila.get("prioridad_revision_pendiente"):
        prioridad += f" (provisional: {fila['prioridad_provisional']}; revisión JEFE)"
    return [fila["codigo"], fila["asunto"], fila["area_nombre"] or "Área no disponible",
        fila["fecha_registro"].astimezone(LIMA).replace(tzinfo=None), prioridad, fila["estado"],
        fila["responsable_nombre"] or "Sin responsable"]


def generar_excel(datos: dict) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill

    libro = Workbook()
    resumen = libro.active
    resumen.title = "Resumen"
    resumen.append([MUNICIPALIDAD])
    resumen.append(["Reporte institucional de incidencias"])
    resumen.append(["Período (fecha de registro)", datos["periodo"]])
    resumen.append(["Generado (America/Lima)", fecha_local(datos["fecha_generacion"])])
    resumen.append(["Alcance", "Estados vigentes de las incidencias registradas en el período; prioridad oficial"])
    resumen.append([])
    for etiqueta, campo in [("Total", "total"), ("Pendientes", "pendientes"), ("En revisión", "en_revision"), ("Cerradas", "cerradas")]:
        resumen.append([etiqueta, datos["resumen"][campo]])
    for clave, titulo in [("areas", "Por área municipal"), ("prioridades", "Por prioridad oficial"), ("responsables", "Por responsable actual o de cierre")]:
        resumen.append([])
        resumen.append([titulo, "Total"])
        for grupo in datos["desgloses"][clave]:
            resumen.append([grupo["nombre"] or "No disponible", grupo["total"]])
    filtros = libro.create_sheet("Filtros")
    filtros.append(["Filtro", "Valor aplicado"])
    for etiqueta, valor in datos["filtros_aplicados"].items():
        filtros.append([etiqueta, valor])
    filtros.append(["Zona horaria", "America/Lima"])
    filtros.append(["Generado", fecha_local(datos["fecha_generacion"])])
    incidencias = libro.create_sheet("Incidencias")
    incidencias.append(CABECERAS)
    for fila in datos["incidencias"]:
        incidencias.append(valores_fila(fila))
    incidencias.freeze_panes = "A2"
    incidencias.auto_filter.ref = incidencias.dimensions
    anchos = [24, 65, 30, 23, 40, 20, 36]
    for columna, ancho in zip("ABCDEFG", anchos):
        incidencias.column_dimensions[columna].width = ancho
    for celda in incidencias["D"][1:]:
        celda.number_format = "dd/mm/yyyy hh:mm"
    resumen.column_dimensions["A"].width = 48
    resumen.column_dimensions["B"].width = 90
    filtros.column_dimensions["A"].width = 38
    filtros.column_dimensions["B"].width = 90
    for hoja in libro:
        for fila in hoja:
            for celda in fila:
                # Literal incluso si el asunto/nombre comienza con =, +, -, @ o un error Excel.
                if isinstance(celda.value, str):
                    celda.data_type = "s"
                celda.alignment = Alignment(vertical="top", wrap_text=True)
        for celda in hoja[1]:
            celda.font = Font(bold=True, color="FFFFFF")
            celda.fill = PatternFill("solid", fgColor="15314B")
        hoja.sheet_view.showGridLines = False
    salida = BytesIO()
    try:
        libro.save(salida)
        return salida.getvalue()
    finally:
        libro.close()
        salida.close()


@lru_cache(maxsize=1)
def fuentes_pdf():
    import reportlab
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    fuentes = Path(reportlab.__file__).parent / "fonts"
    pdfmetrics.registerFont(TTFont("ReporteVera", str(fuentes / "Vera.ttf")))
    pdfmetrics.registerFont(TTFont("ReporteVeraBold", str(fuentes / "VeraBd.ttf")))
    pdfmetrics.registerFontFamily("ReporteVera", normal="ReporteVera", bold="ReporteVeraBold")


def generar_pdf(datos: dict) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfgen.canvas import Canvas
    from reportlab.platypus import KeepTogether, LongTable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    fuentes_pdf()
    azul = colors.HexColor("#0C315E")
    tinta = colors.HexColor("#182C42")
    linea = colors.HexColor("#C5D6E8")
    claro = colors.HexColor("#EFF6FD")
    escudo = Path(__file__).with_name("escudo_reporte.png")
    salida = BytesIO()
    documento = SimpleDocTemplate(salida, pagesize=A4, rightMargin=36, leftMargin=36,
        topMargin=96, bottomMargin=49, title="Reporte de gestión de incidencias", author=MUNICIPALIDAD)
    ancho = documento.width - 12

    normal = ParagraphStyle("NormalReporte", fontName="ReporteVera", fontSize=9, leading=13, textColor=tinta,
        splitLongWords=True)
    titulo = ParagraphStyle("TituloReporte", parent=normal, fontName="ReporteVeraBold", fontSize=16, leading=21,
        alignment=TA_CENTER, textColor=azul, spaceAfter=5)
    epigrafe = ParagraphStyle("EpigrafeReporte", parent=normal, alignment=TA_CENTER, textColor=azul)
    seccion = ParagraphStyle("SeccionReporte", parent=normal, fontName="ReporteVeraBold", fontSize=10.5,
        textColor=azul, spaceBefore=12, spaceAfter=5, keepWithNext=True)
    celda = ParagraphStyle("CeldaReporte", parent=normal, fontSize=7.1, leading=10)
    cabecera = ParagraphStyle("CabeceraReporte", parent=celda, fontName="ReporteVeraBold", textColor=colors.white)
    cifra = ParagraphStyle("CifraReporte", parent=epigrafe, fontName="ReporteVeraBold", fontSize=17, leading=21)
    etiqueta = ParagraphStyle("EtiquetaReporte", parent=epigrafe, fontSize=8, leading=10)

    def parrafo(texto, estilo=normal):
        return Paragraph(escape(str(texto)).replace("\n", "<br/>"), estilo)

    def campo(nombre, valor):
        return Paragraph(f"<b>{escape(str(nombre))}</b><br/>{escape(str(valor))}", normal)

    def caja(filas, anchos):
        return Table(filas, colWidths=anchos, style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), claro),
            ("BOX", (0, 0), (-1, -1), .6, linea),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 9),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))

    fecha = fecha_local(datos["fecha_generacion"])
    autor = datos.get("emitido_por") or "Jefatura de Sistemas"
    filtros = datos["filtros_aplicados"]
    criterios = [
        [campo("Período de registro", datos["periodo"]), campo("Estado", filtros.get("Estado", "Todos los estados"))],
        [campo("Área municipal", filtros.get("Área municipal", "Todas las áreas")),
         campo("Responsable", filtros.get("Responsable actual o de cierre", "Todos los responsables"))],
        [campo("Prioridad oficial", filtros.get("Prioridad oficial", "Todas las prioridades")),
         campo("Tipo de reporte", "Consolidado")],
    ]
    elementos = [
        parrafo("REPORTE DE GESTIÓN DE INCIDENCIAS", titulo),
        parrafo("Informe de consulta institucional", epigrafe),
        Spacer(1, 8),
        caja([[campo("Emitido por", autor), campo("Fecha de generación", f"{fecha} (Lima)")],
              [campo("Asunto", "Situación de las incidencias de soporte TI"), ""]], [ancho / 2] * 2),
        Spacer(1, 9),
        parrafo("Se informa el estado de las incidencias registradas en el sistema según los criterios de consulta aplicados."),
        parrafo("I.  CRITERIOS DE CONSULTA", seccion),
        caja(criterios, [ancho / 2] * 2),
        parrafo("II.  RESUMEN DE RESULTADOS", seccion),
    ]

    r = datos["resumen"]
    columnas = [("Registradas", "total", "#E9F3FF"), ("Pendientes", "pendientes", "#FFF3D7"),
                ("En revisión", "en_revision", "#F0EBFF"), ("Cerradas", "cerradas", "#E6F6ED")]
    resumen = Table([[[parrafo(r[clave], cifra), parrafo(nombre, etiqueta)] for nombre, clave, _ in columnas]],
                    colWidths=[ancho / 4] * 4)
    resumen.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), .6, linea),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        *[("BACKGROUND", (i, 0), (i, 0), colors.HexColor(color)) for i, (_, _, color) in enumerate(columnas)],
    ]))
    elementos.extend([resumen, Spacer(1, 6), parrafo(
        f"Del total consultado, el {100 * r['pendientes'] / r['total']:.0f} % está pendiente de atención."
        if r["total"] else "No existen incidencias que coincidan con los filtros aplicados."),
        parrafo("III.  DETALLE DE INCIDENCIAS", seccion)])

    filas = [[parrafo(h, cabecera) for h in ["N.º", *CABECERAS]]]
    for numero, fila in enumerate(datos["incidencias"], 1):
        valores = valores_fila(fila)
        valores[3] = fecha_local(fila["fecha_registro"])
        filas.append([parrafo(v, celda) for v in [numero, *valores]])
    tabla = LongTable(filas, colWidths=[ancho * p for p in (.045, .145, .20, .115, .11, .13, .10, .155)],
                      repeatRows=1, splitInRow=1)
    tabla.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), azul),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, claro]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), .35, linea),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elementos.append(tabla)

    if r["pendientes"]:
        conclusion = f"Quedan {r['pendientes']} incidencias pendientes. Se recomienda evaluar sus prioridades y comprobar que cuenten con un responsable."
    elif r["en_revision"]:
        conclusion = f"Hay {r['en_revision']} incidencias en revisión. Se recomienda dar seguimiento a las atenciones hasta su cierre."
    elif r["total"]:
        conclusion = "La consulta no registra incidencias pendientes ni en revisión."
    else:
        conclusion = "La consulta no registra incidencias con los criterios seleccionados."
    elementos.append(KeepTogether([
        parrafo("IV.  CONCLUSIÓN Y ACCIÓN RECOMENDADA", seccion), parrafo(conclusion),
        Spacer(1, 14), parrafo(autor, epigrafe), parrafo("Jefatura de Sistemas · Unidad de Racionalización e Informática", epigrafe),
    ]))

    def membrete(canvas, _):
        canvas.saveState()
        x, y = 42, A4[1] - 74
        if escudo.is_file():
            # El recurso institucional incluye un fondo. En el membrete se
            # recorta en torno al contorno del escudo original.
            escala = 54 / 85
            origen_x, origen_y = x + 33 - 80 * escala, y + 4 - 53 * escala
            contorno = canvas.beginPath()
            puntos = [(65, 41), (63, 31), (69, 23), (80, 21), (91, 23), (97, 31), (95, 41),
                      (106, 44), (107, 84), (103, 94), (96, 103), (80, 108), (64, 103),
                      (57, 94), (53, 84), (53, 44)]
            for indice, (px, py) in enumerate(puntos):
                punto = (origen_x + px * escala, origen_y + (160 - py) * escala)
                (contorno.moveTo if indice == 0 else contorno.lineTo)(*punto)
            contorno.close()
            canvas.saveState()
            canvas.clipPath(contorno, stroke=0, fill=0)
            canvas.drawImage(str(escudo), origen_x, origen_y, 160 * escala, 160 * escala, mask="auto")
            canvas.restoreState()
        canvas.setStrokeColor(azul)
        canvas.setLineWidth(.6)
        canvas.line(x + 68, y + 6, x + 68, y + 57)
        canvas.setFillColor(azul)
        canvas.setFont("ReporteVeraBold", 12)
        canvas.drawCentredString(A4[0] / 2 + 35, y + 39, MUNICIPALIDAD.upper())
        canvas.setFont("ReporteVeraBold", 9)
        canvas.drawCentredString(A4[0] / 2 + 35, y + 23, "UNIDAD DE RACIONALIZACIÓN E INFORMÁTICA")
        canvas.setLineWidth(1.4)
        canvas.line(x, y, A4[0] - x, y)
        canvas.restoreState()

    class CanvasPaginado(Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._paginas_reporte = []

        def showPage(self):
            self._paginas_reporte.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._paginas_reporte)
            for estado in self._paginas_reporte:
                self.__dict__.update(estado)
                self.setStrokeColor(azul)
                self.line(42, 37, A4[0] - 42, 37)
                self.setFont("ReporteVera", 8)
                self.setFillColor(azul)
                self.drawString(42, 23, "Sistema de Gestión de Incidencias · Informe sin firma incorporada")
                self.drawRightString(A4[0] - 42, 23, f"Página {self.getPageNumber()} de {total}")
                super().showPage()
            super().save()

    try:
        documento.build(elementos, onFirstPage=membrete, onLaterPages=membrete, canvasmaker=CanvasPaginado)
        return salida.getvalue()
    finally:
        salida.close()
