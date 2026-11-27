"""Archivos institucionales generados localmente, sin enlaces ni servicios externos."""
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from textwrap import wrap
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
    from openpyxl.chart import BarChart, DoughnutChart, Reference
    from openpyxl.chart.data_source import AxDataSource, NumData, NumVal, StrData, StrRef, StrVal
    from openpyxl.chart.label import DataLabelList
    from openpyxl.chart.series import DataPoint
    from openpyxl.drawing.image import Image
    from openpyxl.drawing.spreadsheet_drawing import AnchorMarker, OneCellAnchor
    from openpyxl.drawing.xdr import XDRPositiveSize2D
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
    from openpyxl.utils.units import pixels_to_EMU

    libro = Workbook()
    resumen = libro.active
    resumen.title = "Resumen"
    filtros = libro.create_sheet("Filtros")
    incidencias = libro.create_sheet("Incidencias")
    azul, tinta, claro, blanco = "103858", "102D4E", "DBEAF8", "FFFFFF"
    fecha = fecha_local(datos["fecha_generacion"])
    periodo = datos["periodo"]
    if periodo == "Sin límite inicial al Sin límite final":
        periodo = "Sin límite de fechas"
    total = datos["resumen"]["total"]
    estados = [
        ("Pendientes", "pendientes", "FFF4D8", "835200", "E9A700"),
        ("En revisión", "en_revision", "E4F1FD", "13588E", "2778C4"),
        ("Cerradas", "cerradas", "E6F4E8", "22723B", "2D9658"),
    ]

    def estilo(celda, fondo=None, color=tinta, negrita=False, tamano=11, centrado=False):
        celda.font = Font(name="Calibri", size=tamano, bold=negrita, color=color)
        if fondo:
            celda.fill = PatternFill("solid", fgColor=fondo)
        celda.alignment = Alignment(horizontal="center" if centrado else "left",
                                    vertical="center", wrap_text=True, indent=0 if centrado else 1)
        # Los datos del reporte se escriben como texto literal, incluso si parecen fórmulas.
        if isinstance(celda.value, str):
            celda.data_type = "s"

    def bloque(hoja, rango, valor, fondo=None, **formato):
        hoja.merge_cells(rango)
        celda = hoja[rango.split(":")[0]]
        celda.value = valor
        estilo(celda, fondo, **formato)
        return celda

    def cabecera(hoja, ultima, titulo, subtitulo, inicio_texto="B", dato_derecha=None):
        hoja.sheet_view.showGridLines = False
        # Las celdas bajo el escudo distinguen la marca del texto institucional.
        bloque(hoja, f"A1:{inicio_texto}3", None, azul)
        inicio = get_column_letter(hoja[inicio_texto + "1"].column + 1)
        bloque(hoja, f"{inicio}1:{ultima}2", MUNICIPALIDAD.upper(), azul, color=blanco, negrita=True, tamano=19)
        bloque(hoja, f"{inicio}3:{ultima}3", "Unidad de Racionalización e Informática", azul, color=blanco, tamano=13)
        escudo = Path(__file__).with_name("escudo_reporte.png")
        if escudo.is_file():
            imagen = Image(BytesIO(escudo.read_bytes()))
            altura = 64
            ancho = round(imagen.width * altura / imagen.height)
            imagen.anchor = OneCellAnchor(
                _from=AnchorMarker(col=0, row=0, colOff=pixels_to_EMU(24), rowOff=pixels_to_EMU(6)),
                ext=XDRPositiveSize2D(pixels_to_EMU(ancho), pixels_to_EMU(altura)),
            )
            hoja.add_image(imagen)
        for indice in (1, 2, 3):
            hoja.row_dimensions[indice].height = 19
        bloque(hoja, f"A4:{ultima}4", titulo, color=azul, negrita=True, tamano=18)
        hoja.row_dimensions[4].height = 32
        bloque(hoja, f"A5:{'F' if dato_derecha else ultima}5", subtitulo, claro, negrita=True)
        if dato_derecha:
            bloque(hoja, f"G5:{ultima}5", dato_derecha, claro, negrita=True)
        hoja.row_dimensions[5].height = 24

    for hoja in (resumen, filtros):
        for indice in range(1, 12):
            hoja.column_dimensions[get_column_letter(indice)].width = 14 if indice != 6 else 3
    cabecera(resumen, "K", "REPORTE DE GESTIÓN DE INCIDENCIAS", f"Período: {periodo}", dato_derecha=f"Generado: {fecha}")
    resumen.row_dimensions[7].height = 22
    resumen.row_dimensions[8].height = 34
    tarjetas = [("Total de incidencias", "total", "E4F1FD", azul, None), *estados]
    for (primera, ultima), (nombre, clave, fondo, color, _) in zip(("AC", "DE", "GI", "JK"), tarjetas):
        bloque(resumen, f"{primera}7:{ultima}7", nombre, fondo, color=color, negrita=True, centrado=True)
        bloque(resumen, f"{primera}8:{ultima}8", datos["resumen"][clave], fondo, color=color,
               negrita=True, tamano=23, centrado=True)

    responsables = datos["desgloses"]["responsables"]
    for indice, (nombre, clave, *_) in enumerate(estados, 1):
        cantidad = datos["resumen"][clave]
        resumen.cell(indice, 14, f"{nombre} ({cantidad})")
        resumen.cell(indice, 15, cantidad)
    principales = sorted(responsables, key=lambda grupo: -grupo["total"])[:5]
    for indice, grupo in enumerate(principales, 1):
        resumen.cell(indice, 16, grupo["nombre"] or "No disponible").data_type = "s"
        resumen.cell(indice, 17, grupo["total"])
    resumen.column_dimensions.group("N", "Q", hidden=True)

    def datos_grafico(grafico, columna_texto, cantidad):
        categorias = Reference(resumen, min_col=columna_texto, min_row=1, max_row=cantidad)
        totales = Reference(resumen, min_col=columna_texto + 1, min_row=1, max_row=cantidad)
        grafico.add_data(totales)
        serie = grafico.series[0]
        serie.cat = AxDataSource(strRef=StrRef(f=str(categorias), strCache=StrData(
            ptCount=cantidad, pt=[StrVal(idx=i, v=resumen.cell(i + 1, columna_texto).value) for i in range(cantidad)],
        )))
        serie.val.numRef.numCache = NumData(ptCount=cantidad,
            pt=[NumVal(idx=i, v=resumen.cell(i + 1, columna_texto + 1).value) for i in range(cantidad)])
        grafico.visible_cells_only = False
        grafico.width, grafico.height = 13, 6.2

    if total:
        dona = DoughnutChart()
        dona.title = f"Distribución por estado · {total} incidencias"
        dona.holeSize = 63
        datos_grafico(dona, 14, len(estados))
        for indice, (_, _, _, _, color) in enumerate(estados):
            punto = DataPoint(idx=indice)
            punto.graphicalProperties.solidFill = color
            dona.series[0].data_points.append(punto)
        dona.dataLabels = DataLabelList(showPercent=True, dLblPos="bestFit")
        resumen.add_chart(dona, "A10")
    else:
        bloque(resumen, "A10:E10", "Distribución por estado", claro, negrita=True)
        bloque(resumen, "A11:E11", "Sin incidencias para el período", "F4F8FC")
    if principales:
        barras = BarChart()
        barras.type = "bar"
        barras.title = "Incidencias por responsable" if len(responsables) <= len(principales) else "Incidencias por responsable · 5 principales"
        barras.legend = None
        barras.x_axis.scaling.orientation = "maxMin"
        barras.y_axis.scaling.min = 0
        datos_grafico(barras, 16, len(principales))
        barras.series[0].graphicalProperties.solidFill = "2778C4"
        barras.dataLabels = DataLabelList(showVal=True, dLblPos="outEnd")
        resumen.add_chart(barras, "G10")
    else:
        bloque(resumen, "G10:K10", "Incidencias por responsable", claro, negrita=True)
        bloque(resumen, "G11:K11", "Sin registros para el período", "F4F8FC")

    def desglose(fila, columnas, titulo, grupos):
        nombre, fin_nombre, cantidad, porcentaje = columnas
        bloque(resumen, f"{nombre}{fila}:{porcentaje}{fila}", titulo, negrita=True, tamano=12)
        for i, registro in enumerate([("Categoría", "Total", "Porcentaje"),
                *((grupo["nombre"] or "No disponible", grupo["total"], grupo["total"] / total if total else 0)
                  for grupo in grupos),
                ("Total", sum(grupo["total"] for grupo in grupos), sum(grupo["total"] for grupo in grupos) / total if total else 0)]):
            r = fila + i + 1
            destacado = i in (0, len(grupos) + 1)
            fondo = claro if destacado else ("F0F6FC" if i % 2 == 0 else blanco)
            bloque(resumen, f"{nombre}{r}:{fin_nombre}{r}", registro[0], fondo, negrita=destacado)
            for col, valor in zip((cantidad, porcentaje), registro[1:]):
                celda = resumen[f"{col}{r}"]
                celda.value = valor
                estilo(celda, fondo, negrita=destacado, centrado=True)
            if i:
                resumen[f"{porcentaje}{r}"].number_format = "0%"
            resumen.row_dimensions[r].height = 22
        return r

    fin = max(
        desglose(23, "ACDE", "Distribución por área municipal", datos["desgloses"]["areas"]),
        desglose(23, "GIJK", "Distribución por prioridad oficial", datos["desgloses"]["prioridades"]),
    )
    bloque(resumen, f"A{fin + 2}:K{fin + 2}",
           "Alcance: estados vigentes de las incidencias registradas en el período y prioridad oficial.", claro)
    if len(responsables) > len(principales):
        desglose(fin + 4, "ACDE", "Responsable actual o de cierre", responsables)

    cabecera(filtros, "K", "CRITERIOS DE CONSULTA DEL REPORTE", "Parámetros utilizados para generar la información exportada.")
    filtros_aplicados = {"Fecha de registro": periodo}
    filtros_aplicados.update((clave, valor) for clave, valor in datos["filtros_aplicados"].items() if clave != "Fecha de registro")
    metadatos = {"Fecha de generación": fecha, "Zona horaria": "America/Lima",
                 "Registros exportados": len(datos["incidencias"]), "Módulo": "Reportes institucionales"}
    for titulo, columnas, valores in (("Filtros aplicados", "ACDE", filtros_aplicados),
                                      ("Información de exportación", "GHIK", metadatos)):
        inicio, fin_etiqueta, inicio_valor, ultima = columnas
        bloque(filtros, f"{inicio}7:{ultima}7", titulo, azul, color=blanco, negrita=True, tamano=12)
        for fila, (etiqueta, valor) in enumerate(valores.items(), 8):
            filtros.row_dimensions[fila].height = 33
            bloque(filtros, f"{inicio}{fila}:{fin_etiqueta}{fila}", etiqueta, claro, negrita=True)
            bloque(filtros, f"{inicio_valor}{fila}:{ultima}{fila}", valor, "F4F8FC")
    nota = 9 + max(len(filtros_aplicados), len(metadatos))
    bloque(filtros, f"A{nota}:K{nota}", "Los datos corresponden a los criterios seleccionados al generar el reporte.", claro)
    filtros.row_dimensions[nota].height = 24

    cabecera(incidencias, "H", "REGISTRO DETALLADO DE INCIDENCIAS", f"Período: {periodo}   ·   Total de registros: {len(datos['incidencias'])}", "B")
    encabezados = ["N.º", "Código", "Asunto", "Área municipal", "Fecha de registro", "Prioridad oficial", "Estado", "Responsable"]
    for indice, (etiqueta, ancho) in enumerate(zip(encabezados, (8, 23, 43, 25, 23, 32, 18, 39)), 1):
        incidencias.column_dimensions[get_column_letter(indice)].width = ancho
        estilo(incidencias.cell(7, indice, etiqueta), azul, color=blanco, negrita=True, centrado=True)
    incidencias.row_dimensions[7].height = 24
    colores_estado = {nombre: (fondo, color) for nombre, _, fondo, color, _ in estados}
    colores_estado["Pendiente"] = colores_estado["Pendientes"]
    colores_estado["Cerrado"] = colores_estado["Cerradas"]
    for numero, fila in enumerate(datos["incidencias"], 1):
        fila_excel = numero + 7
        fondo = "EEF5FC" if numero % 2 == 0 else blanco
        valores = valores_fila(fila)
        for columna, valor in enumerate([numero, *valores], 1):
            fondo_celda, color = colores_estado.get(valor, (fondo, tinta)) if columna == 7 else (fondo, tinta)
            estilo(incidencias.cell(fila_excel, columna, valor), fondo_celda, color=color,
                   negrita=columna in (2, 7), centrado=columna in (1, 5, 7))
        incidencias.cell(fila_excel, 5).number_format = "dd/mm/yyyy hh:mm"
        lineas = max(sum(max(1, len(wrap(parte, ancho))) for parte in valor.split("\n"))
                     for valor, ancho in zip(valores, (20, 39, 22, 20, 28, 16, 34)) if isinstance(valor, str))
        incidencias.row_dimensions[fila_excel].height = min(409, max(22, lineas * 16 + 4))
    incidencias.sheet_format.defaultRowHeight = 22
    incidencias.freeze_panes = "A8"
    incidencias.auto_filter.ref = f"A7:H{incidencias.max_row}"
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
