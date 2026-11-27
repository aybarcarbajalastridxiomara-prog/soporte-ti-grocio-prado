import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import ts from "typescript"

const compile = (source) => "data:text/javascript;base64," + Buffer.from(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText).toString("base64")
const sessionURL = compile(await fs.readFile(new URL("../src/session.ts", import.meta.url), "utf8"))
const { GestorSesion, SesionExpirada } = await import(sessionURL)
const fixture = (access = "prueba-inicial", refresh = "prueba-refresh", seconds = 3600) => ({ access_token: access, refresh_token: refresh, expires_in: seconds })

test("las peticiones concurrentes comparten renovación y rotan el refresh_token", async () => {
  let requests = 0
  let received = ""
  const manager = new GestorSesion(async (refresh) => { requests++; received = refresh; await Promise.resolve(); return fixture("nuevo", "rotado") })
  manager.establecer(fixture())
  assert.deepEqual(await Promise.all([manager.renovar("prueba-inicial"), manager.renovar("prueba-inicial")]), ["nuevo", "nuevo"])
  assert.equal(requests, 1)
  assert.equal(await manager.obtenerToken("prueba-inicial"), "nuevo")
  await manager.renovar("nuevo")
  assert.equal(received, "rotado")
})

test("la renovación anticipada funciona también con props que conservan el token anterior", async () => {
  let count = 0
  const manager = new GestorSesion(async () => fixture(`rotado-${++count}`, "refresh", 1))
  manager.establecer(fixture("inicial", "refresh", 1))
  assert.equal(await manager.obtenerToken("inicial"), "rotado-1")
  assert.equal(await manager.obtenerToken("inicial"), "rotado-2")
})

test("logout durante renovación no restaura una sesión ni permite cruzar identidades", async () => {
  let complete
  const manager = new GestorSesion(() => new Promise((resolve) => { complete = resolve }))
  manager.establecer(fixture())
  const pending = manager.renovar("prueba-inicial")
  manager.limpiar()
  manager.establecer(fixture("otra-identidad", "otro-refresh"))
  complete(fixture("token-tardio"))
  await assert.rejects(pending, SesionExpirada)
  await assert.rejects(manager.obtenerToken("prueba-inicial"), SesionExpirada)
  assert.equal(await manager.obtenerToken("otra-identidad"), "otra-identidad")
})

test("un refresh revocado vuelve al login; un fallo temporal permite reintentar", async () => {
  let expired = 0
  const manager = new GestorSesion(async () => { throw new SesionExpirada() })
  manager.alExpirar = () => expired++
  manager.establecer(fixture())
  await assert.rejects(manager.renovar("prueba-inicial"), SesionExpirada)
  assert.equal(expired, 1)
  let count = 0
  const retry = new GestorSesion(async () => { if (++count === 1) throw new Error("Conexión"); return fixture("recuperada") })
  retry.establecer(fixture())
  await assert.rejects(retry.renovar("prueba-inicial"), /Conexión/)
  assert.equal(await retry.renovar("prueba-inicial"), "recuperada")
})

const env = { VITE_API_BASE_URL: "https://api.example.invalid", VITE_SUPABASE_URL: "https://auth.example.invalid", VITE_SUPABASE_ANON_KEY: "clave-publica-prueba" }
const source = (await fs.readFile(new URL("../src/api.ts", import.meta.url), "utf8"))
  .replaceAll('"./session"', JSON.stringify(sessionURL)).replaceAll("import.meta.env", JSON.stringify(env))
const api = await import(compile(source))
const json = (value, status = 200) => new Response(JSON.stringify(value), { status })

test("401 renueva una sola vez, conserva el cuerpo y los permisos 403 no renuevan", async () => {
  const originalFetch = globalThis.fetch
  let refreshes = 0
  let calls = 0
  const bodies = []
  try {
    api.sesionReal.establecer(fixture())
    globalThis.fetch = async (url, options) => {
      if (url.includes("grant_type=refresh_token")) { refreshes++; return json(fixture("renovado")) }
      bodies.push(options.body)
      calls++
      return options.headers.get("Authorization") === "Bearer renovado" ? json({ ok: true }) : json({}, 401)
    }
    assert.deepEqual(await Promise.all([api.solicitarAPI("/api/prueba", "prueba-inicial", { method: "POST", body: '{"prueba":true}' }), api.solicitarAPI("/api/prueba", "prueba-inicial")]), [{ ok: true }, { ok: true }])
    assert.equal(refreshes, 1)
    assert.equal(calls, 4)
    assert.equal(bodies.filter((body) => body === '{"prueba":true}').length, 2)
    globalThis.fetch = async () => json({}, 403)
    await assert.rejects(api.solicitarAPI("/api/prueba", "prueba-inicial"), /permiso/)
    assert.equal(refreshes, 1)
  } finally { globalThis.fetch = originalFetch; api.sesionReal.limpiar() }
})

test("un segundo 401 termina la sesión sin bucles ni repetición ilimitada de escrituras", async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  let expired = 0
  try {
    api.sesionReal.establecer(fixture())
    api.sesionReal.alExpirar = () => expired++
    globalThis.fetch = async (url) => {
      calls++
      return url.includes("grant_type=refresh_token") ? json(fixture("renovado")) : json({}, 401)
    }
    await assert.rejects(api.solicitarAPI("/api/prueba", "prueba-inicial"), SesionExpirada)
    assert.equal(calls, 3)
    assert.equal(expired, 1)
  } finally { globalThis.fetch = originalFetch; api.sesionReal.limpiar(); api.sesionReal.alExpirar = null }
})

test("la invitación retira los tokens del URL y permite establecer contraseña sin persistirla", async () => {
  const originalWindow = globalThis.window
  const originalFetch = globalThis.fetch
  let cleaned = ""
  try {
    globalThis.window = {
      location: { hash: "#type=invite&access_token=solo-prueba&refresh_token=refresh-prueba&expires_in=3600", pathname: "/", search: "" },
      history: { replaceState: (_state, _title, url) => { cleaned = url } },
    }
    const session = api.recibirInvitacionReal()
    assert.equal(cleaned, "/")
    assert.equal(session.access_token, "solo-prueba")
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://auth.example.invalid/auth/v1/user")
      assert.equal(options.method, "PUT")
      assert.equal(options.headers.Authorization, "Bearer solo-prueba")
      assert.deepEqual(JSON.parse(options.body), { password: "clave-larga-solo-prueba" })
      return json({})
    }
    await api.establecerClaveInvitada(session.access_token, "clave-larga-solo-prueba")
  } finally { globalThis.window = originalWindow; globalThis.fetch = originalFetch; api.sesionReal.limpiar() }
})
