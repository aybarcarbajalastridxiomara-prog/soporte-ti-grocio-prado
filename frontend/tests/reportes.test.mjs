import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ts from "typescript"

const compile = source => {
  const output = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText.replace(/from "(react(?:\/jsx-runtime)?)"/g, (_, name) => `from ${JSON.stringify(import.meta.resolve(name))}`)
  return "data:text/javascript;base64," + Buffer.from(output).toString("base64")
}
const session = compile(await fs.readFile(new URL("../src/session.ts", import.meta.url), "utf8"))
const env = { VITE_SUPABASE_URL: "https://auth.example.invalid", VITE_SUPABASE_ANON_KEY: "publica-ficticia", VITE_API_BASE_URL: "https://api.example.invalid" }
const apiURL = compile((await fs.readFile(new URL("../src/api.ts", import.meta.url), "utf8"))
  .replaceAll('"./session"', JSON.stringify(session)).replaceAll("import.meta.env", JSON.stringify(env)))
const api = await import(apiURL)
const reportesURL = compile((await fs.readFile(new URL("../src/reportes.ts", import.meta.url), "utf8"))
  .replace('"./api"', JSON.stringify(apiURL)))
const reportes = await import(reportesURL)
const uiURL = compile(await fs.readFile(new URL("../src/RealUI.tsx", import.meta.url), "utf8"))
const { default: RealReports } = await import(compile((await fs.readFile(new URL("../src/RealReports.tsx", import.meta.url), "utf8"))
  .replace('"./reportes"', JSON.stringify(reportesURL)).replace('"./RealUI"', JSON.stringify(uiURL))))
const token = "ficticio-reportes"
const xlsxMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
const fijarSesion = () => api.sesionReal.establecer({ access_token: token, refresh_token: "refresh-ficticio", expires_in: 3600 })

async function transporte(handler, run) {
  const original = globalThis.fetch
  const calls = []
  fijarSesion()
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return handler(url, options, calls.length) }
  try { await run(calls) } finally { globalThis.fetch = original; api.sesionReal.limpiar() }
}

test("consulta envía filtros y página al servidor, sin actor ni filtrado parcial del cliente", async () => {
  await transporte(() => new Response('{"resumen":{"total":237},"incidencias":[]}'), async calls => {
    const filtros = { ...reportes.filtrosVacios, desde: "2026-11-01", hasta: "2026-11-18", area_id: "area-qa", estado: "Cerrado", prioridad: "Alta", responsable_id: "persona-qa", actor_id: "no-enviar" }
    const datos = await reportes.consultarReporte(token, filtros, 3, 100)
    const url = new URL(calls[0].url)
    assert.equal(url.pathname, "/api/reportes/incidencias")
    assert.deepEqual(Object.fromEntries(url.searchParams), { desde: "2026-11-01", hasta: "2026-11-18", area_id: "area-qa", estado: "Cerrado", prioridad: "Alta", responsable_id: "persona-qa", pagina: "3", tamano_pagina: "100" })
    assert.equal(datos.resumen.total, 237)
    assert.equal(new Headers(calls[0].options.headers).get("Authorization"), `Bearer ${token}`)
    assert.equal(calls[0].options.cache, "no-store")
  })
})

test("exportación descarga bytes auténticos y omite paginación para incluir todas las coincidencias", async () => {
  await transporte(() => new Response("contenido-xlsx-ficticio", { headers: { "Content-Type": xlsxMime } }), async calls => {
    const filtros = { ...reportes.filtrosVacios, prioridad: "sin_evaluar", pagina: 8, tamano_pagina: 25 }
    const archivo = await reportes.descargarReporte(token, filtros, "xlsx")
    assert.equal(await archivo.text(), "contenido-xlsx-ficticio")
    assert.deepEqual(Object.fromEntries(new URL(calls[0].url).searchParams), { prioridad: "sin_evaluar", formato: "xlsx" })
    assert.equal(calls[0].options.redirect, "error")
  })
})

test("un 401 en descarga renueva una vez y preserva filtros sin filtrar el token al URL", async () => {
  let renovaciones = 0
  await transporte((url, options) => {
    if (url.includes("grant_type=refresh_token")) {
      renovaciones++
      return new Response(JSON.stringify({ access_token: "renovado-qa", refresh_token: "rotado-qa", expires_in: 3600 }))
    }
    if (new Headers(options.headers).get("Authorization") !== "Bearer renovado-qa") return new Response("{}", { status: 401 })
    return new Response("%PDF-ficticio", { headers: { "Content-Type": "application/pdf" } })
  }, async calls => {
    const archivo = await reportes.descargarReporte(token, { ...reportes.filtrosVacios, estado: "Cerrado" }, "pdf")
    assert.equal(await archivo.text(), "%PDF-ficticio")
    assert.equal(renovaciones, 1)
    const descargas = calls.filter(c => new URL(c.url).pathname === "/api/reportes/incidencias/exportar")
    assert.equal(descargas.length, 2)
    assert.equal(descargas[0].url, descargas[1].url)
    assert(!descargas[0].url.includes(token))
  })
})

test("403, errores JSON y HTML no se convierten en documentos ni provocan renovación", async () => {
  for (const [body, status, type, patron] of [["{}", 403, "application/json", /permiso/],
    ['{"detail":"Reduce el período"}', 422, "application/json", /Reduce el período/],
    ["<html>Error</html>", 200, "text/html", /formato solicitado/]]) {
    await transporte(() => new Response(body, { status, headers: { "Content-Type": type } }), async calls => {
      await assert.rejects(reportes.descargarReporte(token, reportes.filtrosVacios, "pdf"), patron)
      assert.equal(calls.length, 1)
    })
  }
})

test("rechaza archivo vacío, exceso de tamaño y rutas ajenas; conserva la cancelación", async () => {
  for (const body of ["", "x".repeat(4_000_001)]) {
    await transporte(() => new Response(body, { headers: { "Content-Type": "application/pdf" } }), async () => {
      await assert.rejects(reportes.descargarReporte(token, reportes.filtrosVacios, "pdf"), /vacío|tamaño/)
    })
  }
  await assert.rejects(api.solicitarArchivoReporte("https://externo.invalid/", token, "pdf"), /Ruta/)
  const controller = new AbortController()
  controller.abort()
  await transporte((url, options) => { options.signal.throwIfAborted() }, async calls => {
    await assert.rejects(reportes.descargarReporte(token, reportes.filtrosVacios, "pdf", controller.signal), { name: "AbortError" })
    assert.equal(calls[0].options.signal, controller.signal)
  })
})

test("pantalla inicial muestra filtros fijos y cabeceras sin datos inventados ni exportación a Excel", () => {
  const html = renderToStaticMarkup(createElement(RealReports, { token, abrirDetalle: () => assert.fail("Solo render") }))
  assert.match(html, /Reportes institucionales/)
  for (const label of ["Desde", "Hasta", "Área municipal", "Estado", "Prioridad oficial", "Responsable actual o de cierre"]) assert(html.includes(label))
  assert.equal([...html.matchAll(/<th scope="col">/g)].length, 8)
  assert.match(html, /<tbody><\/tbody>/)
  assert.match(html, /<section class="card report-filter-card" aria-labelledby="report-filter-title">/)
  assert.match(html, /button class="outline" type="button" disabled="">[^<]*(?:<svg[\s\S]*?<\/svg>)?Exportar PDF/)
  assert.doesNotMatch(html, /Exportar Excel|Ocultar filtros|report-kpis|report-context/)
  assert.doesNotMatch(html, /INC-2026|Tesorería|Sistemas - Pruebas/)
})
