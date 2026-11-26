
/**
 * Cliente API real - Soporte TI Grocio Prado.
 * No modifica el prototipo hasta ser importado.
 * Nunca guardar contraseñas ni claves privadas aquí.
 */

import { GestorSesion, SesionExpirada, type SesionReal } from "./session"
export type { SesionReal } from "./session"

const API_URL = (
  import.meta.env.VITE_API_BASE_URL || ""
).trim().replace(/\/+$/, "")
const API_MISMO_ORIGEN = import.meta.env.VITE_QA_MISMO_ORIGEN === "true"

const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL || ""
).trim().replace(/\/+$/, "")

const PUBLIC_KEY = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || ""
).trim()

export type Rol = "JEFE" | "ASISTENTE" |
  "PRACTICANTE" | "REPRESENTANTE"

export type PerfilReal = {
  id: string
  nombre_completo: string
  usuario: string
  area_id: string
  rol: Rol
  habilitado: boolean
  area_nombre?: string | null
}

export type IncidenciaReal = {
  id: string
  codigo: string
  area_id: string
  asunto: string
  estado: "Pendiente" | "En revisión" | "Cerrado"
  prioridad: string | null
  prioridad_provisional?: string | null
  prioridad_revision_pendiente?: boolean
  fecha_registro: string
  area_nombre?: string | null
  responsable_id?: string | null
  responsable_nombre?: string | null
  responsable_tipo?: "activo" | "cierre" | "sin_asignar" | null
}

export type NuevaIncidencia = {
  asunto: string
  descripcion: string
  categoria?: string | null
  equipo_sistema_afectado?: string | null
  ubicacion?: string | null
  impacto?: "Si" | "Parcialmente" | "No" | null
  fecha_inicio_problema?: string | null
  hora_inicio_problema?: string | null
  reincidente?: boolean
  incidencia_anterior_id?: string | null
  detalle_reincidencia?: string | null
}

function validarSesion(valor: unknown): SesionReal {
  const sesion = valor as SesionReal | null
  if (!sesion || typeof sesion.access_token !== "string" || !sesion.access_token ||
    typeof sesion.refresh_token !== "string" || !sesion.refresh_token ||
    typeof sesion.expires_in !== "number" || !Number.isFinite(sesion.expires_in) || sesion.expires_in <= 0) {
    throw new SesionExpirada()
  }
  return sesion
}

export const sesionReal = new GestorSesion(async (refresh_token) => {
  const respuesta = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: PUBLIC_KEY },
    body: JSON.stringify({ refresh_token }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  })
  if ([400, 401, 403].includes(respuesta.status)) throw new SesionExpirada()
  if (!respuesta.ok) throw new Error("No se pudo renovar la sesión. Comprueba la conexión e intenta nuevamente.")
  return validarSesion(await respuesta.json())
})

/** Consume únicamente enlaces Auth admitidos y retira tokens antes de consultar. */
export function recibirEnlaceAuthReal(): { sesion: SesionReal; tipo: "invite" | "recovery" } | null {
  const consulta = new URLSearchParams(window.location.search)
  if (["code", "token_hash", "access_token", "refresh_token"].some(k => consulta.has(k))) {
    for (const k of ["code", "token_hash", "access_token", "refresh_token", "type"]) consulta.delete(k)
    window.history.replaceState(null, "", window.location.pathname + (consulta.size ? `?${consulta}` : ""))
    throw new Error("Este enlace necesita un flujo de Auth no configurado. Solicita un enlace compatible al operador.")
  }
  const parametros = new URLSearchParams(window.location.hash.slice(1))
  if (!parametros.has("access_token") && !parametros.has("error")) return null
  // Retirar credenciales de la barra y del historial antes de consultar el perfil.
  window.history.replaceState(null, "", window.location.pathname + window.location.search)
  if (parametros.has("error")) throw new Error("El enlace de acceso expiró o no es válido. Solicita uno nuevo.")
  const tipo = parametros.get("type")
  if (tipo !== "invite" && tipo !== "recovery") throw new Error("Enlace de acceso no compatible. Inicia sesión con tu cuenta institucional.")
  if (parametros.has("expires_at") && (!Number.isFinite(Number(parametros.get("expires_at"))) || Number(parametros.get("expires_at")) * 1000 <= Date.now())) throw new Error("El enlace expiró. Solicita uno nuevo.")
  const sesion = validarSesion({
    access_token: parametros.get("access_token"), refresh_token: parametros.get("refresh_token"),
    expires_in: Number(parametros.get("expires_in")),
  })
  sesionReal.establecer(sesion)
  return { sesion, tipo }
}

export function recibirInvitacionReal(): SesionReal | null {
  const enlace = recibirEnlaceAuthReal()
  if (enlace && enlace.tipo !== "invite") { sesionReal.limpiar(); throw new Error("Utiliza la pantalla de recuperación.") }
  return enlace?.sesion ?? null
}

export const recuperacionHabilitada = import.meta.env.VITE_RECUPERACION_HABILITADA === "true"
let ultimaSolicitudRecuperacion = 0
export async function solicitarRecuperacionReal(correo: string) {
  if (!recuperacionHabilitada || !SUPABASE_URL || !PUBLIC_KEY) throw new Error("Recuperación pendiente de configurar y validar con Supabase Auth.")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) throw new Error("Introduce un correo válido.")
  if (Date.now() - ultimaSolicitudRecuperacion < 60000) throw new Error("Espera un minuto antes de solicitar otro enlace.")
  const destino = new URL(window.location.pathname, window.location.origin)
  if (destino.protocol !== "https:" && !["127.0.0.1", "localhost"].includes(destino.hostname)) throw new Error("El acceso necesita HTTPS.")
  ultimaSolicitudRecuperacion = Date.now()
  let respuesta: Response
  try {
    respuesta = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(destino.href)}`, {
      method: "POST", headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: correo.trim() }), cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error",
    })
  } catch { throw new Error("No se pudo contactar a Auth. Comprueba la conexión antes de reintentar.") }
  if (respuesta.status === 429) throw new Error("Auth limitó los intentos. Espera antes de solicitar otro enlace.")
  if (!respuesta.ok) throw new Error("Auth no confirmó la solicitud. Revisa la configuración de correo y los requisitos de acceso.")
  return "Si existe una cuenta apta para recuperación, recibirás un enlace. Revisa tu correo y la carpeta de spam."
}

export async function completarRecuperacionReal(token: string, identidad: string, nueva: string) {
  if (nueva.length < 12) throw new Error("Usa una contraseña de al menos 12 caracteres.")
  const propia = await consultarUsuarioAuth(token)
  if (propia.id !== identidad || !sesionReal.esSesionActual(token)) throw new SesionExpirada()
  const access = await sesionReal.obtenerToken(token)
  const respuesta = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT", headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password: nueva }), cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error",
  })
  if ([401, 403].includes(respuesta.status)) sesionReal.expirar()
  if (!respuesta.ok) throw new Error("Auth no confirmó la nueva contraseña. Revisa su política o solicita otro enlace.")
  const usuario = await respuesta.json() as UsuarioAuth
  if (usuario.id !== identidad) throw new Error("No se pudo confirmar la identidad. Vuelve al login.")
  await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=global`, { method: "POST", headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${access}` }, cache: "no-store", signal: AbortSignal.timeout(5000) }).catch(() => undefined)
  sesionReal.limpiar()
}

export async function cerrarSesionReal(token: string) {
  try {
    const access = await sesionReal.obtenerToken(token)
    const respuesta = await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {method:"POST",headers:{apikey:PUBLIC_KEY,Authorization:`Bearer ${access}`},cache:"no-store",signal:AbortSignal.timeout(10000),redirect:"error"})
    if (!respuesta.ok && respuesta.status !== 401) throw new Error("La sesión local se cerró; no se pudo confirmar su revocación en Auth.")
  } finally { sesionReal.limpiar() }
}

export async function establecerClaveInvitada(token: string, password: string) {
  const access = await sesionReal.obtenerToken(token)
  const respuesta = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT", headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({ password }), cache: "no-store",
    signal: AbortSignal.timeout(15000),
  })
  if ([401, 403].includes(respuesta.status)) sesionReal.expirar()
  if (!respuesta.ok) throw new Error("No se pudo establecer la contraseña. Revisa los requisitos de tu cuenta e intenta nuevamente.")
}

export async function iniciarSesionReal(
  correo: string,
  contrasena: string,
): Promise<SesionReal> {
  if (!SUPABASE_URL || !PUBLIC_KEY) {
    throw new Error(
      "Falta configurar Supabase en el frontend."
    )
  }

  const respuesta = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: PUBLIC_KEY,
      },
      body: JSON.stringify({
        email: correo.trim(),
        password: contrasena,
      }),
      signal: AbortSignal.timeout(15000),
    }
  )

  if (!respuesta.ok) {
    throw new Error(
      "No se pudo iniciar sesión. Verifica tus credenciales."
    )
  }

  const sesion = validarSesion(await respuesta.json())
  sesionReal.establecer(sesion)
  return sesion
}

async function solicitarRespuesta(
  ruta: string,
  token: string,
  opciones: RequestInit = {},
): Promise<Response> {
  if (!API_URL && !API_MISMO_ORIGEN) {
    throw new Error("Falta configurar la URL del backend.")
  }

  if (!ruta.startsWith("/api/")) {
    throw new Error("Ruta de API no permitida.")
  }

  if (!token) {
    throw new Error("Debes iniciar sesión.")
  }

  const headers = new Headers(opciones.headers)
  let tokenActual = await sesionReal.obtenerToken(token)
  headers.set("Authorization", `Bearer ${tokenActual}`)

  if (opciones.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const enviar = () => fetch(API_MISMO_ORIGEN ? ruta : `${API_URL}${ruta}`, {
    ...opciones,
    headers,
    cache: "no-store",
    signal: opciones.signal ?? AbortSignal.timeout(30000),
  })

  let respuesta = await enviar()
  if (respuesta.status === 401) {
    tokenActual = await sesionReal.renovar(tokenActual)
    headers.set("Authorization", `Bearer ${tokenActual}`)
    respuesta = await enviar()
  }
  if (respuesta.status === 401) {
    sesionReal.expirar()
  }

  if (respuesta.status === 403) {
    throw new Error("No tienes permiso para esta operación.")
  }

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => null) as { detail?: unknown } | null
    throw new Error(
      typeof datos?.detail === "string" ? datos.detail : `No se pudo completar la operación (${respuesta.status}).`
    )
  }

  return respuesta
}

export async function solicitarAPI<T>(ruta: string, token: string, opciones: RequestInit = {}): Promise<T> {
  return await (await solicitarRespuesta(ruta, token, opciones)).json() as T
}

export function subirAdjuntoReal(token: string, incidencia: string, archivo: File) {
  if (!archivo.size || archivo.size > 4_000_000) throw new Error("El archivo debe contener datos y no superar 4 MB.")
  return solicitarAPI(`/api/incidencias/${encodeURIComponent(incidencia)}/adjuntos?nombre=${encodeURIComponent(archivo.name)}`,token,
    {method:"POST",headers:{"Content-Type":archivo.type || "application/octet-stream"},body:archivo,redirect:"error"})
}

export async function descargarAdjuntoReal(token: string, incidencia: string, adjunto: string) {
  const respuesta = await solicitarRespuesta(`/api/incidencias/${encodeURIComponent(incidencia)}/adjuntos/${encodeURIComponent(adjunto)}/descargar`,token,{redirect:"error"})
  const tipo=respuesta.headers.get("Content-Type")?.split(";")[0]
  if (!tipo || !["image/jpeg","image/png","image/webp","application/pdf"].includes(tipo)) throw new Error("No se recibió un adjunto permitido.")
  const blob=await respuesta.blob()
  if(!blob.size || blob.size>4_000_000) throw new Error("Tamaño de descarga no permitido.")
  return blob
}

export async function solicitarArchivoReporte(ruta: string, token: string, formato: "pdf" | "xlsx", signal?: AbortSignal): Promise<Blob> {
  if (!ruta.startsWith("/api/reportes/incidencias/exportar?")) throw new Error("Ruta de descarga no permitida.")
  const respuesta = await solicitarRespuesta(ruta, token, { signal: signal ?? AbortSignal.timeout(60000), redirect: "error" })
  const esperado = formato === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  if (respuesta.headers.get("Content-Type")?.split(";")[0].trim() !== esperado) {
    throw new Error("El servidor no devolvió el formato solicitado.")
  }
  const archivo = await respuesta.blob()
  if (!archivo.size || archivo.size > 4_000_000) throw new Error("El archivo recibido está vacío o supera el tamaño permitido.")
  return archivo
}

export function consultarPerfilReal(token: string) {
  return solicitarAPI<PerfilReal>("/api/me", token)
}

export function listarIncidenciasReales(token: string, opciones: { misAtenciones?: boolean; estado?: string; limite?: number } = {}) {
  const parametros = new URLSearchParams()
  if (opciones.misAtenciones) parametros.set("mis_atenciones", "true")
  if (opciones.estado) parametros.set("estado", opciones.estado)
  if (opciones.limite) parametros.set("limite", String(opciones.limite))
  return solicitarAPI<IncidenciaReal[]>(
    `/api/incidencias${parametros.size ? `?${parametros}` : ""}`,
    token,
  )
}

export type UsuarioAuth = { id: string; email?: string; email_confirmed_at?: string | null }

/** Solo la identidad propia de Auth; nunca el directorio administrativo. */
export async function consultarUsuarioAuth(token: string): Promise<UsuarioAuth> {
  let access = await sesionReal.obtenerToken(token)
  const enviar = () => fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${access}` },
    cache: "no-store", signal: AbortSignal.timeout(15000),
  })
  let respuesta = await enviar()
  if (respuesta.status === 401) { access = await sesionReal.renovar(access); respuesta = await enviar() }
  if (respuesta.status === 401) sesionReal.expirar()
  if (!respuesta.ok) throw new Error("No se pudo verificar tu identidad en Supabase Auth.")
  const usuario = await respuesta.json() as UsuarioAuth
  if (!usuario.id) throw new Error("La identidad recibida no es válida.")
  return usuario
}

/** Reautenticación independiente: nunca sustituye la sesión de otra pestaña/identidad. */
export async function cambiarClaveReal(token: string, identidad: string, actual: string, nueva: string) {
  if (!actual || nueva.length < 12) throw new Error("Introduce la contraseña actual y una nueva de al menos 12 caracteres.")
  const usuario = await consultarUsuarioAuth(token)
  if (usuario.id !== identidad || !usuario.email) throw new Error("La identidad no coincide con tu perfil. Inicia sesión nuevamente.")
  let accesoReautenticado = ""
  try {
    const respuesta = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: usuario.email, password: actual }), cache: "no-store",
      signal: AbortSignal.timeout(15000),
    })
    if (respuesta.status === 429) throw new Error("Demasiados intentos. Espera antes de volver a intentar.")
    if (!respuesta.ok) throw new Error("No se pudo reautenticar. Revisa tu contraseña actual y los requisitos de acceso de Supabase.")
    const datos = await respuesta.json() as SesionReal & { user?: UsuarioAuth }
    accesoReautenticado = validarSesion(datos).access_token
    if (datos.user?.id !== identidad) throw new Error("La reautenticación no corresponde a tu cuenta.")
    if (!sesionReal.esSesionActual(token)) throw new SesionExpirada()
    const cambio = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT", headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${accesoReautenticado}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password: nueva, current_password: actual }), cache: "no-store",
      signal: AbortSignal.timeout(15000),
    })
    if (!cambio.ok) {
      const error = await cambio.json().catch(() => null) as { code?: string } | null
      if (cambio.status === 429) throw new Error("Demasiados intentos. Espera antes de volver a intentar.")
      if (error?.code?.startsWith("reauthentication")) throw new Error("Supabase requiere una verificación adicional. El cambio queda pendiente hasta completar ese mecanismo de Auth; no se modificó la contraseña.")
      if (error?.code === "same_password") throw new Error("La nueva contraseña debe ser diferente de la actual.")
      if (error?.code === "weak_password") throw new Error("La nueva contraseña no cumple la política de seguridad de Supabase.")
      if (cambio.status === 401) throw new Error("La reautenticación expiró. Vuelve a intentarlo.")
      throw new Error("Supabase no confirmó el cambio. Revisa los requisitos de tu cuenta.")
    }
    const cambiado = await cambio.json() as UsuarioAuth
    if (cambiado.id !== identidad) throw new Error("No se pudo confirmar la identidad de la cuenta actualizada. Vuelve al login.")
  } finally {
    // Revocar solo la sesión temporal creada para comprobar la clave actual.
    if (accesoReautenticado) await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
      method: "POST", headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${accesoReautenticado}` },
      cache: "no-store", signal: AbortSignal.timeout(5000),
    }).catch(() => undefined)
  }
}

export type ResumenReal = { total: number; pendientes: number; en_revision: number; cerradas: number }
export function consultarResumenReal(token: string) {
  return solicitarAPI<ResumenReal>("/api/incidencias/resumen", token)
}

export function registrarIncidenciaReal(
  token: string,
  datos: NuevaIncidencia,
) {
  return solicitarAPI<IncidenciaReal>(
    "/api/incidencias",
    token,
    {
      method: "POST",
      body: JSON.stringify(datos),
    },
  )
}
