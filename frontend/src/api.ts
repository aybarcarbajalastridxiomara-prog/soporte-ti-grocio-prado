
/**
 * Cliente API real - Soporte TI Grocio Prado.
 * No modifica el prototipo hasta ser importado.
 * Nunca guardar contraseñas ni claves privadas aquí.
 */

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

export type SesionReal = {
  access_token: string
  refresh_token: string
  expires_in: number
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
    }
  )

  if (!respuesta.ok) {
    throw new Error(
      "No se pudo iniciar sesión. Verifica tus credenciales."
    )
  }

  const sesion = await respuesta.json() as SesionReal

  if (!sesion.access_token) {
    throw new Error("Supabase no devolvió una sesión válida.")
  }

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
  headers.set("Authorization", `Bearer ${token}`)

  if (opciones.body) {
    headers.set("Content-Type", "application/json")
  }

  const respuesta = await fetch(`${API_URL}${ruta}`, {
    ...opciones,
    headers,
    cache: "no-store",
  })

  if (respuesta.status === 401) {
    throw new Error("Sesión inválida o expirada.")
  }

  if (respuesta.status === 403) {
    throw new Error("No tienes permiso para esta operación.")
  }

  if (!respuesta.ok) {
    throw new Error(
      `No se pudo completar la operación (${respuesta.status}).`
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
