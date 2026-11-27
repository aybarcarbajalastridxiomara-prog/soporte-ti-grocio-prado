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
const { guardarAsignacion } = await import(compile((await fs.readFile(new URL("../src/assignmentOperations.ts", import.meta.url), "utf8")).replace('"./api"', JSON.stringify(apiUrl))))
const token = "token-ficticio", id = "ticket-qa"
const contexto = (ciclo = 1, activa = false) => ({ incidencia_id: id, ciclo_actual: ciclo, permisos_verificados: true,
  puede_asignar: !activa, puede_reasignar: activa,
  tecnico_activo: activa ? { id: "tecnico-anterior", asignacion_id: "asignacion-anterior" } : null,
  ruta_asignacion: ciclo > 1 ? `/api/v4/incidencias/${id}/asignar` : `/api/asignaciones/${id}/asignar`,
  ruta_reasignacion: ciclo > 1 ? `/api/v4/incidencias/${id}/reasignar` : `/api/asignaciones/${id}/reasignar`,
})
async function transporte(vigente, run, status = 201) {
  const calls = [], anterior = globalThis.fetch
  api.sesionReal.establecer({ access_token: token, refresh_token: "refresh-ficticio", expires_in: 3600 })
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify(options?.method === "POST" ? status === 201 ? { tecnico_id: "tecnico-nuevo" } : { detail: "Conflicto de responsable" } : vigente), { status: options?.method === "POST" ? status : 200 })
  }
  try { await run(calls) } finally { globalThis.fetch = anterior; api.sesionReal.limpiar() }
}

test("asignación revalida contexto y envía el técnico sin actor del cliente", async () => {
  const c = contexto()
  await transporte(c, async calls => {
    await guardarAsignacion(token, id, c, "tecnico-nuevo", "")
    assert.equal(calls.length, 2)
    assert(calls[1].url.endsWith(c.ruta_asignacion))
    assert.deepEqual(JSON.parse(calls[1].options.body), { tecnico_id: "tecnico-nuevo" })
  })
})
test("reasignación V3 y V4 incluyen motivo, ciclo y versión del responsable", async () => {
  for (const ciclo of [1, 2]) {
    const c = contexto(ciclo, true)
    await transporte(c, async calls => {
      await guardarAsignacion(token, id, c, "tecnico-nuevo", "  Cambio de turno  ")
      assert(calls[1].url.endsWith(c.ruta_reasignacion))
      assert.deepEqual(JSON.parse(calls[1].options.body), { nuevo_tecnico_id: "tecnico-nuevo", motivo: "Cambio de turno", asignacion_actual_id: "asignacion-anterior", ciclo_actual: ciclo })
    })
  }
})
test("cambio de ciclo, responsable, permisos o ruta impide el POST", async () => {
  const c = contexto(2, true)
  for (const cambio of [{ ciclo_actual: 3 }, { permisos_verificados: false }, { tecnico_activo: { asignacion_id: "otra" } }, { ruta_reasignacion: "/api/asignaciones/ticket-qa/reasignar" }, { incidencia_id: "otro-ticket" }]) {
    await transporte({ ...c, ...cambio }, async calls => {
      await assert.rejects(guardarAsignacion(token, id, c, "tecnico-nuevo", "Cambio de turno"))
      assert.equal(calls.length, 1)
    })
  }
})
test("409 de concurrencia se muestra sin repetir la escritura", async () => {
  const c = contexto(2, true)
  await transporte(c, async calls => {
    await assert.rejects(guardarAsignacion(token, id, c, "tecnico-nuevo", "Cambio de turno"), /Conflicto de responsable/)
    assert.equal(calls.filter(c => c.options?.method === "POST").length, 1)
  }, 409)
})
