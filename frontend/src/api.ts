
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
  fecha_registro: string
}

export type NuevaIncidencia = {
  asunto: string
  descripcion: string
  categoria?: string | null
  equipo_sistema_afectado?: string | null
  ubicacion?: string | null
  impacto?: "Si" | "Parcialmente" | "No" | null
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

/** El enlace de invitación de Auth vuelve al Site URL autorizado por Supabase. */
export function recibirInvitacionReal(): SesionReal | null {
  const parametros = new URLSearchParams(window.location.hash.slice(1))
  if (!parametros.has("access_token") && !parametros.has("error")) return null
  // Retirar credenciales de la barra y del historial antes de consultar el perfil.
  window.history.replaceState(null, "", window.location.pathname + window.location.search)
  if (parametros.has("error")) throw new Error("El enlace de invitación expiró o no es válido. Contacta a la jefatura.")
  if (parametros.get("type") !== "invite") throw new Error("Enlace de acceso no compatible. Inicia sesión con tu cuenta institucional.")
  const sesion = validarSesion({
    access_token: parametros.get("access_token"), refresh_token: parametros.get("refresh_token"),
    expires_in: Number(parametros.get("expires_in")),
  })
  sesionReal.establecer(sesion)
  return sesion
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

export async function solicitarAPI<T>(
  ruta: string,
  token: string,
  opciones: RequestInit = {},
): Promise<T> {
  if (!API_URL) {
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

  if (opciones.body) {
    headers.set("Content-Type", "application/json")
  }

  const enviar = () => fetch(`${API_URL}${ruta}`, {
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

  return await respuesta.json() as T
}

export function consultarPerfilReal(token: string) {
  return solicitarAPI<PerfilReal>("/api/me", token)
}

export function listarIncidenciasReales(token: string) {
  return solicitarAPI<IncidenciaReal[]>(
    "/api/incidencias",
    token,
  )
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
