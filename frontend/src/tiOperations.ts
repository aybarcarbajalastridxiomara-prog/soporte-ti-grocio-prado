import { solicitarAPI } from "./api"

export type Prioridad = "Alta" | "Media" | "Baja"
export type ContextoToma = {
  incidencia_id: string; ciclo_actual: number; esquema_v4: boolean
  puede_tomar: boolean; motivo: string; ruta_toma: string
}
export type ContextoPrioridad = {
  incidencia_id: string; ciclo_actual: number; impacto: string | null; sugerida: Prioridad | null
  oficial: string | null; provisional: Prioridad | null; revision_pendiente: boolean
  version: string | null; actor_id: string | null; fecha: string | null; justificacion: string | null
  puede_establecer: boolean; operacion: "provisional" | "confirmacion" | null; motivo: string
}

const base = (id: string) => `/api/incidencias/${encodeURIComponent(id)}`
export const consultarToma = (token: string, id: string) => solicitarAPI<ContextoToma>(`${base(id)}/contexto-toma`, token)
export const consultarPrioridad = (token: string, id: string) => solicitarAPI<ContextoPrioridad>(`${base(id)}/contexto-prioridad`, token)

export function tomarIncidencia(token: string, id: string, contexto: ContextoToma) {
  const ruta = contexto.ciclo_actual > 1 ? `/api/v4/incidencias/${encodeURIComponent(id)}/tomar` : `/api/asignaciones/${encodeURIComponent(id)}/tomar`
  if (!contexto.puede_tomar || contexto.incidencia_id !== id || contexto.ruta_toma !== ruta ||
      contexto.ciclo_actual < 1 || (contexto.ciclo_actual > 1 && !contexto.esquema_v4)) {
    throw new Error("La incidencia no está disponible para toma. Actualiza el contexto.")
  }
  return solicitarAPI<unknown>(ruta, token, { method: "POST",
    ...(contexto.ciclo_actual > 1 ? { body: JSON.stringify({ ciclo_actual: contexto.ciclo_actual }) } : {}),
  })
}

export function establecerPrioridad(token: string, id: string, contexto: ContextoPrioridad, prioridad: Prioridad, justificacion: string) {
  if (!contexto.puede_establecer || contexto.incidencia_id !== id) throw new Error("No tienes autorización vigente para establecer prioridad.")
  return solicitarAPI<ContextoPrioridad>(`${base(id)}/prioridad`, token, { method: "POST", body: JSON.stringify({
    prioridad, justificacion: justificacion.trim(), ciclo_actual: contexto.ciclo_actual,
    version: contexto.version, anterior: contexto.oficial,
  }) })
}

export function descripcionPrioridad(accion: string, descripcion: string) {
  if (!["PRIORIDAD_PROVISIONAL", "PRIORIDAD_CONFIRMADA"].includes(accion)) return descripcion
  try {
    const dato = JSON.parse(descripcion)
    if (dato.formato !== "prioridad-112c-v1") return descripcion
    return `${dato.provisional ? "Propuesta provisional, pendiente del JEFE" : "Prioridad confirmada por el JEFE"}: ${dato.anterior || "Sin definir"} → ${dato.nueva}. Ciclo ${dato.ciclo}. Motivo: ${dato.justificacion}`
  } catch { return descripcion }
}
