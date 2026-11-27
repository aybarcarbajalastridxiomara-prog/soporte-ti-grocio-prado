import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import ts from "typescript"

const compile = source => "data:text/javascript;base64," + Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString("base64")
const session = compile(await fs.readFile(new URL("../src/session.ts", import.meta.url), "utf8"))
const env = { VITE_SUPABASE_URL: "https://auth.example.invalid", VITE_SUPABASE_ANON_KEY: "publica-prueba", VITE_API_BASE_URL: "https://api.example.invalid" }
const source = (await fs.readFile(new URL("../src/api.ts", import.meta.url), "utf8")).replaceAll('"./session"', JSON.stringify(session)).replaceAll("import.meta.env", JSON.stringify(env))
const api = await import(compile(source))
const fixture = { access_token: "sesion-aislada", refresh_token: "refresh-aislado", expires_in: 3600 }
const nueva = "Nueva-clave-solo-prueba"
const identity = { id: "identidad-aislada", email: "propia@example.invalid" }
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })
async function transporte(handler, run) {
  const original = globalThis.fetch
  api.sesionReal.establecer(fixture)
  globalThis.fetch = handler
  try { await run() } finally { globalThis.fetch = original; api.sesionReal.limpiar() }
}

test("cambio reautentica con correo canónico, verifica identidad y revoca solo la sesión temporal", async () => {
  const calls = []
  await transporte(async (url, options) => {
    calls.push([url, options])
    if (url.includes("grant_type=password")) return json({ ...fixture, access_token: "reauth", user: identity })
    return json(identity)
  }, async () => {
    await api.cambiarClaveReal(fixture.access_token, identity.id, "Actual-solo-prueba", nueva)
    assert.equal(calls.length, 4)
    assert.deepEqual(JSON.parse(calls[1][1].body), { email: identity.email, password: "Actual-solo-prueba" })
    assert.deepEqual(JSON.parse(calls[2][1].body), { password: nueva, current_password: "Actual-solo-prueba" })
    assert.equal(calls[2][1].headers.Authorization, "Bearer reauth")
    assert(calls[3][0].endsWith("logout?scope=local"))
    assert.equal(await api.sesionReal.obtenerToken(fixture.access_token), fixture.access_token)
    assert(calls.every(([url, options]) => url.startsWith(env.VITE_SUPABASE_URL) && options.cache === "no-store"))
  })
})
test("contraseña actual incorrecta no cambia la clave ni invalida la sesión principal", async () => {
  let puts = 0
  await transporte(async (url, options) => {
    if (options.method === "PUT") puts++
    return url.includes("grant_type=password") ? json({ code: "invalid_credentials" }, 400) : json(identity)
  }, async () => {
    await assert.rejects(api.cambiarClaveReal(fixture.access_token, identity.id, "incorrecta", nueva), /reautenticar/)
    assert.equal(puts, 0)
    assert(api.sesionReal.esSesionActual(fixture.access_token))
  })
})
test("identidad distinta y logout durante reautenticación impiden el PUT", async () => {
  for (const scenario of ["identidad", "logout"]) {
    let puts = 0
    await transporte(async (url, options) => {
      if (options.method === "PUT") puts++
      if (url.includes("grant_type=password")) {
        if (scenario === "logout") api.sesionReal.limpiar()
        return json({ ...fixture, user: scenario === "identidad" ? { id: "otra-identidad" } : identity })
      }
      return json(identity)
    }, async () => {
      await assert.rejects(api.cambiarClaveReal(fixture.access_token, identity.id, "Actual", nueva))
      assert.equal(puts, 0)
    })
  }
})
test("políticas, nonce y límite de intentos se muestran sin falso éxito ni filtrar respuestas", async () => {
  for (const [code, status, message] of [["weak_password", 422, /política/], ["same_password", 422, /diferente/], ["reauthentication_needed", 400, /verificación adicional/], ["over_request_rate_limit", 429, /Demasiados/]]) {
    let logout = false
    await transporte(async (url, options) => {
      if (url.includes("grant_type=password")) return json({ ...fixture, user: identity })
      if (options.method === "PUT") return json({ code, message: "dato-privado-que-no-se-muestra" }, status)
      if (url.includes("logout")) logout = true
      return json(identity)
    }, async () => {
      await assert.rejects(api.cambiarClaveReal(fixture.access_token, identity.id, "Actual", nueva), message)
      assert(logout)
    })
  }
})
test("mis atenciones y antecedentes usan filtros de servidor, sin identificadores del cliente", async () => {
  const urls = []
  await transporte(async (url) => { urls.push(url); return json([]) }, async () => {
    await api.listarIncidenciasReales(fixture.access_token, { misAtenciones: true })
    await api.listarIncidenciasReales(fixture.access_token, { estado: "Cerrado", limite: 100 })
    assert(urls[0].endsWith("?mis_atenciones=true"))
    assert(urls[1].endsWith("?estado=Cerrado&limite=100"))
  })
})
