import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const compile = source => {
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
  } })
  const resolved = outputText.replace(/from "(react(?:\/jsx-runtime)?)"/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`)
  return "data:text/javascript;base64," + Buffer.from(resolved).toString("base64")
}
const ui = compile(await fs.readFile(new URL("../src/RealUI.tsx", import.meta.url), "utf8"))
const source = (await fs.readFile(new URL("../src/RealTicketList.tsx", import.meta.url), "utf8")).replace('"./RealUI"', JSON.stringify(ui))
const { default: RealTicketList } = await import(compile(source))
const render = props => renderToStaticMarkup(createElement(RealTicketList, {
  titulo: "Listado autorizado", incidencias: [], disponible: true, cargando: false,
  abrirDetalle: () => assert.fail("No debe abrir detalles durante el render"), ...props,
}))
const propias = "No tienes incidencias asignadas"

test("consulta vacía exitosa conserva siete cabeceras, acciones y región accesible sin filas ficticias", () => {
  const html = render()
  const headers = [...html.matchAll(/<th scope="col">([^<]+)<\/th>/g)].map(match => match[1])
  assert.deepEqual(headers, ["Código", "Asunto", "Área", "Registro", "Prioridad", "Estado", "Responsable", "Acciones"])
  assert.match(html, /tabindex="0" role="region" aria-label="Listado autorizado"/)
  assert.match(html, /<tbody><\/tbody>/)
  assert.match(html, /Todavía no hay incidencias/)
  assert.doesNotMatch(html, /row-action/)
})

test("Mis atenciones muestra su vacío únicamente tras una consulta disponible", () => {
  assert.match(render({ tituloVacio: propias }), new RegExp(propias))
  for (const cargando of [false, true]) {
    const html = render({ tituloVacio: propias, disponible: false, cargando })
    assert.doesNotMatch(html, new RegExp(propias))
    assert.doesNotMatch(html, /Todavía no hay incidencias/)
    assert.match(html, cargando ? /Consultando incidencias…/ : /Listado no disponible/)
  }
})

test("una lista poblada conserva los datos de la consulta y acceso al detalle, sin mensaje vacío", () => {
  const html = render({ tituloVacio: propias, incidencias: [{
    id: "registro-aislado", codigo: "QA-LOCAL", asunto: "Consulta aislada", area_nombre: "Área QA",
    fecha_registro: "2026-11-16T10:00:00Z", prioridad: null, estado: "Pendiente",
    responsable_tipo: "sin_asignar", responsable_nombre: null,
  }] })
  for (const value of ["QA-LOCAL", "Consulta aislada", "Área QA", "Sin definir", "Sin asignar", "Ver detalle de QA-LOCAL"]) {
    assert(html.includes(value))
  }
  assert.doesNotMatch(html, new RegExp(propias))
  assert.doesNotMatch(html, /Todavía no hay incidencias/)
})

test("prioridad provisional se identifica y no se presenta como confirmación oficial", () => {
  const html = render({ incidencias: [{ id: "registro-aislado", codigo: "QA-LOCAL", asunto: "Propuesta aislada",
    fecha_registro: "2026-11-18T10:00:00Z", estado: "En revisión", prioridad: null,
    prioridad_provisional: "Alta", prioridad_revision_pendiente: true, responsable_tipo: "activo",
  }] })
  assert.match(html, /Alta/)
  assert.match(html, /Provisional · revisión JEFE/)
})
