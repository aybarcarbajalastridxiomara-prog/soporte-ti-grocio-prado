import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import ts from "typescript"

const compile = source => "data:text/javascript;base64," + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText).toString("base64")
const session = compile(await fs.readFile(new URL("../src/session.ts", import.meta.url), "utf8"))
const env = { VITE_SUPABASE_URL: "https://auth.example.invalid", VITE_SUPABASE_ANON_KEY: "publica-ficticia", VITE_API_BASE_URL: "https://api.example.invalid" }
const apiUrl = compile((await fs.readFile(new URL("../src/api.ts", import.meta.url), "utf8"))
  .replaceAll('"./session"', JSON.stringify(session)).replaceAll("import.meta.env", JSON.stringify(env)))
const api = await import(apiUrl)
const ti = await import(compile((await fs.readFile(new URL("../src/tiOperations.ts", import.meta.url), "utf8"))
  .replace('"./api"', JSON.stringify(apiUrl))))
const token = "sesion-local-ficticia"
const id = "ticket-ficticio"
const toma = { incidencia_id: id, ciclo_actual: 1, esquema_v4: false, puede_tomar: true, ruta_toma: `/api/asignaciones/${id}/tomar` }
async function transporte(run) {
  const calls = []
  const previous = globalThis.fetch
  api.sesionReal.establecer({ access_token: token, refresh_token: "refresh-ficticio", expires_in: 3600 })
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return new Response("{}", {status: 201}) }
  try { await run(calls) } finally { globalThis.fetch = previous; api.sesionReal.limpiar() }
}

test("autotoma V3 envía la identidad de sesión, sin identificador de técnico del cliente", async () => {
  await transporte(async calls => {
    await ti.tomarIncidencia(token, id, toma)
    assert(calls[0].url.endsWith(toma.ruta_toma))
    assert.equal(calls[0].options.method, "POST")
    assert.equal(calls[0].options.body, undefined)
    assert.equal(new Headers(calls[0].options.headers).get("Authorization"), `Bearer ${token}`)
  })
})

test("autotoma V4 envía el ciclo y rechaza rutas o permisos incompatibles antes de escribir", async () => {
  await transporte(async calls => {
    const contexto = { ...toma, esquema_v4: true, ciclo_actual: 2, ruta_toma: `/api/v4/incidencias/${id}/tomar` }
    await ti.tomarIncidencia(token, id, contexto)
    assert.deepEqual(JSON.parse(calls[0].options.body), { ciclo_actual: 2 })
    for (const cambio of [{ puede_tomar: false }, { ruta_toma: toma.ruta_toma }, { esquema_v4: false }, { incidencia_id: "ajena" }]) {
      assert.throws(() => ti.tomarIncidencia(token, id, { ...contexto, ...cambio }), /contexto/)
    }
    assert.equal(calls.length, 1)
  })
})

test("prioridad transmite valor, justificación y versión sin elegir actor ni oficialidad", async () => {
  await transporte(async calls => {
    const contexto = { incidencia_id: id, puede_establecer: true, ciclo_actual: 2, oficial: null, version: "evento-ficticio", actor_id: "no-se-envia", operacion: "provisional" }
    await ti.establecerPrioridad(token, id, contexto, "Alta", "  Diagnóstico ficticio  ")
    assert.deepEqual(JSON.parse(calls[0].options.body), { prioridad: "Alta", justificacion: "Diagnóstico ficticio", ciclo_actual: 2, version: "evento-ficticio", anterior: null })
    assert.throws(() => ti.establecerPrioridad(token, id, { ...contexto, puede_establecer: false }, "Alta", "Motivo"), /autorización/)
    assert.equal(calls.length, 1)
  })
})

test("historial diferencia propuesta provisional y confirmación conservando texto anterior", () => {
  const data = { formato: "prioridad-112c-v1", provisional: true, anterior: null, nueva: "Alta", ciclo: 2, justificacion: "Motivo ficticio" }
  assert.match(ti.descripcionPrioridad("PRIORIDAD_PROVISIONAL", JSON.stringify(data)), /Propuesta provisional, pendiente del JEFE/)
  assert.match(ti.descripcionPrioridad("PRIORIDAD_CONFIRMADA", JSON.stringify({ ...data, provisional: false })), /confirmada por el JEFE/)
  assert.equal(ti.descripcionPrioridad("CIERRE", "Cierre anterior"), "Cierre anterior")
  assert.equal(ti.descripcionPrioridad("PRIORIDAD_PROVISIONAL", "Texto legado"), "Texto legado")
})
