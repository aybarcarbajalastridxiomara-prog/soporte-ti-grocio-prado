import { solicitarAPI } from "./api"

export type ContextoAsignacion = {
  incidencia_id: string; codigo: string; estado: string; esquema_v4: boolean; ciclo_actual: number
  tecnico_activo: { id: string; asignacion_id: string; nombre_completo: string; rol: string; fecha_asignacion: string } | null
  puede_asignar: boolean; ruta_asignacion: string
  puede_reasignar: boolean; ruta_reasignacion: string; permisos_verificados: boolean
}

export async function guardarAsignacion(token: string, ticketId: string, contexto: ContextoAsignacion, tecnicoId: string, motivo: string) {
  const reasignando = Boolean(contexto.tecnico_activo)
  if (!contexto.permisos_verificados || contexto.incidencia_id !== ticketId || !tecnicoId ||
      (reasignando ? !contexto.puede_reasignar || motivo.trim().length < 5 : !contexto.puede_asignar)) {
    throw new Error("La incidencia o sus permisos no permiten guardar la asignación.")
  }
  const id = encodeURIComponent(ticketId)
  const vigente = await solicitarAPI<ContextoAsignacion>(`/api/incidencias/${id}/contexto-asignacion`, token)
  if (!vigente.permisos_verificados || vigente.incidencia_id !== ticketId || vigente.ciclo_actual !== contexto.ciclo_actual ||
      (reasignando ? !vigente.puede_reasignar || vigente.tecnico_activo?.asignacion_id !== contexto.tecnico_activo?.asignacion_id
        : !vigente.puede_asignar || vigente.tecnico_activo)) throw new Error("La incidencia cambió. Actualízala antes de guardar.")
  const operacion = reasignando ? "reasignar" : "asignar"
  const ruta = vigente.ciclo_actual > 1 ? `/api/v4/incidencias/${id}/${operacion}` : `/api/asignaciones/${id}/${operacion}`
  if ((reasignando ? vigente.ruta_reasignacion : vigente.ruta_asignacion) !== ruta) throw new Error("La ruta no coincide con el ciclo actual.")
  const datos = reasignando ? { nuevo_tecnico_id: tecnicoId, motivo: motivo.trim(),
    asignacion_actual_id: vigente.tecnico_activo!.asignacion_id, ciclo_actual: vigente.ciclo_actual } : { tecnico_id: tecnicoId }
  return solicitarAPI<{ tecnico_id: string }>(ruta, token, { method: "POST", body: JSON.stringify(datos) })
}
