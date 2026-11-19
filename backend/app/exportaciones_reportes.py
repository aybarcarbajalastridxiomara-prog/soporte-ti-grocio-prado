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


def generar_pdf(datos: dict) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, Spacer, TableStyle

    fuentes_pdf()
    salida = BytesIO()
    documento = SimpleDocTemplate(salida, pagesize=landscape(A4), rightMargin=26, leftMargin=26,
        topMargin=28, bottomMargin=32, title="Reporte institucional de incidencias", author=MUNICIPALIDAD)
    normal = ParagraphStyle("NormalReporte", fontName="ReporteVera", fontSize=7, leading=10,
        alignment=TA_LEFT, wordWrap="CJK")
    titulo = ParagraphStyle("TituloReporte", parent=normal, fontName="ReporteVeraBold", fontSize=13, leading=18)
    cabecera = ParagraphStyle("CabeceraReporte", parent=normal, fontName="ReporteVeraBold", textColor=colors.white)

    def parrafo(texto, estilo=normal):
        return Paragraph(escape(str(texto)).replace("\n", "<br/>"), estilo)

    elementos = [parrafo(MUNICIPALIDAD, titulo), parrafo("Reporte institucional de incidencias", titulo),
        Spacer(1, 8), parrafo(f"Período (fecha de registro): {datos['periodo']}"),
        parrafo(f"Generado: {fecha_local(datos['fecha_generacion'])} · America/Lima")]
    for etiqueta, valor in datos["filtros_aplicados"].items():
        elementos.append(parrafo(f"{etiqueta}: {valor}"))
    r = datos["resumen"]
    elementos += [Spacer(1, 9), parrafo(f"Total: {r['total']} · Pendientes: {r['pendientes']} · En revisión: {r['en_revision']} · Cerradas: {r['cerradas']}"),
        parrafo("Estados vigentes del período consultado. Las prioridades provisionales no son decisiones oficiales."), Spacer(1, 12)]
    filas = [[parrafo(h, cabecera) for h in CABECERAS]]
    for fila in datos["incidencias"]:
        valores = valores_fila(fila)
        valores[3] = fecha_local(fila["fecha_registro"])
        filas.append([parrafo(v) for v in valores])
    if not datos["incidencias"]:
        elementos.append(parrafo("No existen incidencias que coincidan con los filtros aplicados."))
    tabla = LongTable(filas, colWidths=[documento.width * p for p in (.105, .24, .14, .13, .12, .1, .165)], repeatRows=1)
    tabla.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#15314B")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F7FA")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), .35, colors.HexColor("#DDE5ED")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6), ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    elementos.append(tabla)

    def pie(canvas, _):
        canvas.setFont("ReporteVera", 7)
        canvas.setFillColor(colors.HexColor("#526879"))
        canvas.drawString(26, 17, "Consulta institucional · Sin firma ni certificación incorporada")
        canvas.drawRightString(landscape(A4)[0] - 26, 17, f"Página {canvas.getPageNumber()}")

    try:
        documento.build(elementos, onFirstPage=pie, onLaterPages=pie)
        return salida.getvalue()
    finally:
        salida.close()
