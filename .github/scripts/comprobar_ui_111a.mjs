/** Prueba local con respuestas interceptadas en memoria. No crea datos ni envía correos. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(pathToFileURL(path.join(process.env.PLAYWRIGHT_MODULE, "index.mjs")).href)
  : await import("playwright")
const browser = await chromium.launch({ channel: "chrome", headless: true })
const output = process.env.EVIDENCIA_DIR || "artifacts/111a"
await fs.mkdir(output, { recursive: true })
const base = process.env.FRONTEND_LOCAL || "http://127.0.0.1:5173"
let cases = 0
try {
  for (const rol of ["JEFE", "REPRESENTANTE", "ASISTENTE", "PRACTICANTE"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    let expired = false
    let withTicket = false
    const perfil = { id: "11111111-1111-4111-8111-111111111111", nombre_completo: `Perfil de prueba ${rol}`, usuario: "prueba_ui", area_id: "22222222-2222-4222-8222-222222222222", rol, habilitado: true }
    const ticket = { id: "33333333-3333-4333-8333-333333333333", codigo: "PRUEBA-UI", area_id: perfil.area_id, asunto: "Verificación aislada de navegación", estado: "Pendiente", prioridad: null, fecha_registro: "2026-11-15T15:00:00Z", descripcion: "Solo respuesta de prueba en memoria" }
    await page.route("https://auth.example.invalid/**", async (route) => {
      assert(route.request().url().includes("/auth/v1/token"))
      await route.fulfill({ status: expired ? 400 : 200, json: expired ? {} : { access_token: "solo-prueba-ui", refresh_token: "solo-refresh-ui", expires_in: 3600 } })
    })
    await page.route("https://api.example.invalid/**", async (route) => {
      assert.equal(route.request().method(), "GET", "Las banderas false deben impedir escrituras")
      const url = new URL(route.request().url())
      if (expired) return route.fulfill({ status: 401, json: {} })
      assert.equal(route.request().headers().authorization, "Bearer solo-prueba-ui")
      let data
      if (url.pathname === "/api/me") data = perfil
      else if (url.pathname === "/api/incidencias") data = withTicket ? [ticket] : []
      else if (url.pathname === "/api/incidencias/resumen") data = { total: withTicket ? 1 : 0, pendientes: withTicket ? 1 : 0, en_revision: 0, cerradas: 0 }
      else if (url.pathname === "/api/usuarios") { assert.equal(rol, "JEFE"); data = [perfil] }
      else if (url.pathname === "/api/areas") data = [{ id: perfil.area_id, nombre: "Área de prueba aislada", activo: true }]
      else if (url.pathname === "/api/administracion/configuracion") data = { edicion_habilitada: false, invitaciones_habilitadas: false, motivos: ["Credencial y SMTP pendientes de configuración."] }
      else if (url.pathname.endsWith("/contexto-asignacion")) data = { ...ticket, incidencia_id: ticket.id, esquema_v4: false, ciclo_actual: 1, tecnico_activo: null, puede_asignar: false, ruta_asignacion: `/api/asignaciones/${ticket.id}/asignar` }
      else if (url.pathname.endsWith("/contexto-atencion")) data = { ...ticket, incidencia_id: ticket.id, esquema_v4: false, ciclo_actual: 1, es_responsable: false, tiene_solucion_final: false, puede_intervenir: false, puede_cerrar: false, ruta_intervencion: `/api/incidencias/${ticket.id}/intervenciones`, ruta_cierre: `/api/incidencias/${ticket.id}/cerrar` }
      else if (url.pathname.endsWith("/contexto-verificacion")) data = { ...ticket, incidencia_id: ticket.id, esquema_v4: false, ciclo_actual: 1, fecha_cierre: null, evaluacion_actual: null, puede_verificar: false, ruta_verificacion: `/api/incidencias/${ticket.id}/verificaciones` }
      else if (url.pathname.endsWith(ticket.id)) data = ticket
      else if (["/historial", "/intervenciones", "/verificaciones", "/tecnicos"].some((suffix) => url.pathname.endsWith(suffix))) data = []
      else throw new Error(`Ruta sin comprobar: ${url.pathname}`)
      await route.fulfill({ json: data })
    })
    await page.goto(base)
    await page.getByLabel("Correo electrónico").fill("prueba@example.invalid")
    await page.getByLabel("Contraseña", { exact: true }).fill("contraseña-solo-prueba")
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click()
    await page.getByRole("heading", { name: "Todavía no hay incidencias" }).waitFor()
    assert.equal(await page.locator(".kpi").count(), 4)
    const nav = page.getByRole("navigation", { name: "Navegación principal" })
    assert.equal(await nav.getByRole("button", { name: "Usuarios y áreas" }).count(), rol === "JEFE" ? 1 : 0)
    assert.equal(await nav.getByRole("button", { name: "Atención técnica" }).count(), rol === "REPRESENTANTE" ? 0 : 1)
    if (rol === "JEFE") {
      await nav.getByRole("button", { name: "Usuarios y áreas" }).click()
      await page.getByRole("heading", { name: "Directorio de usuarios" }).waitFor()
      await page.getByText("Configuración pendiente", { exact: true }).waitFor()
      assert(await page.getByRole("button", { name: "Invitar usuario", exact: true }).isDisabled())
      assert(await page.getByRole("button", { name: "Editar perfil", exact: true }).isDisabled())
    }
    if (rol === "REPRESENTANTE") {
      await nav.getByRole("button", { name: "Panel principal" }).click()
      await page.getByRole("button", { name: "Registrar incidencia", exact: true }).click()
      await page.getByRole("heading", { name: "Registrar nueva incidencia" }).waitFor()
      await page.setViewportSize({ width: 320, height: 812 })
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Registro sin desbordamiento móvil")
      await page.setViewportSize({ width: 1440, height: 1000 })
    }
    await nav.getByRole("button", { name: "Panel principal" }).click()
    withTicket = true
    await page.getByRole("button", { name: "Actualizar", exact: true }).click()
    await page.getByText("PRUEBA-UI", { exact: true }).waitFor()
    await page.getByLabel("Filtrar por estado").selectOption("Cerrado")
    await page.getByRole("heading", { name: "Sin coincidencias" }).waitFor()
    await page.getByRole("button", { name: "Limpiar filtros" }).click()
    await page.getByRole("button", { name: "Ver detalle de PRUEBA-UI" }).click()
    await page.getByRole("heading", { name: "Información de la incidencia" }).waitFor()
    await page.getByRole("button", { name: "Historial (0)" }).click()
    await page.getByText("Todavía no hay eventos en el historial.").waitFor()
    await page.getByRole("button", { name: "← Volver al listado" }).click()
    await page.getByRole("button", { name: "Actualizar", exact: true }).waitFor({ state: "visible" })
    for (const width of [1440, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${rol} sin desbordamiento a ${width}px`)
      if (width === 375) {
        await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
        await nav.getByRole("button", { name: "Mi cuenta" }).click()
        await page.getByRole("heading", { name: "Mi cuenta institucional" }).waitFor()
        await page.getByRole("button", { name: "Abrir menú", exact: true }).click()
        await nav.getByRole("button", { name: "Panel principal" }).click()
      }
      if (rol === "JEFE") await page.screenshot({ path: path.join(output, `dashboard-${width}.png`), fullPage: true, animations: "disabled" })
      cases++
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    expired = true
    await page.getByRole("button", { name: "Actualizar", exact: true }).click()
    await page.getByRole("heading", { name: "Bienvenido", exact: true }).waitFor()
    assert.equal(await page.locator(".sidebar").count(), 0)
    assert.deepEqual(errors, [])
    assert.deepEqual(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })), { local: 0, session: 0 })
    await context.close()
  }
  console.log(`UI 111A: ${cases} combinaciones de rol/ancho aprobadas; navegación, filtros, detalle, flags, administración deshabilitada y expiración OK.`)
} finally { await browser.close() }
