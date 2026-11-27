import { solicitarAPI, solicitarArchivoReporte, type IncidenciaReal, type ResumenReal } from "./api"

export type FiltrosReporte = { desde: string; hasta: string; area_id: string; estado: string; prioridad: string; responsable_id: string }
export const filtrosVacios: FiltrosReporte = { desde: "", hasta: "", area_id: "", estado: "", prioridad: "", responsable_id: "" }
export type GrupoReporte = { id?: string | null; nombre: string | null; total: number }
export type ReporteReal = {
  organizacion: string; fecha_generacion: string; periodo: string; zona_horaria: string
  filtros_aplicados: Record<string, string>; resumen: ResumenReal
  pagina: number; tamano_pagina: number; total_paginas: number; incidencias: IncidenciaReal[]
  desgloses: { areas: GrupoReporte[]; prioridades: GrupoReporte[]; responsables: GrupoReporte[] }
  exportacion: { maximo_filas: number; formatos: ("pdf" | "xlsx")[] }
}
export type CatalogosReporte = {
  areas: { id: string; nombre: string; activo: boolean }[]
  responsables: { id: string; nombre: string; rol: string; habilitado: boolean }[]
}

function parametrosFiltros(filtros: FiltrosReporte) {
  const params = new URLSearchParams()
  // Lista cerrada: no enviar rol, actor, URL, ni propiedades agregadas por el cliente.
  for (const clave of Object.keys(filtrosVacios) as (keyof FiltrosReporte)[]) {
    if (filtros[clave]) params.set(clave, filtros[clave])
  }
  return params
}

export function consultarReporte(token: string, filtros: FiltrosReporte, pagina: number, tamano: number, signal?: AbortSignal) {
  const params = parametrosFiltros(filtros)
  params.set("pagina", String(pagina)); params.set("tamano_pagina", String(tamano))
  return solicitarAPI<ReporteReal>(`/api/reportes/incidencias?${params}`, token, { signal })
}

export function consultarCatalogosReporte(token: string, signal?: AbortSignal) {
  return solicitarAPI<CatalogosReporte>("/api/reportes/catalogos", token, { signal })
}

export function descargarReporte(token: string, filtros: FiltrosReporte, formato: "pdf" | "xlsx", signal?: AbortSignal) {
  const params = parametrosFiltros(filtros)
  params.set("formato", formato)
  // La exportación abarca todas las coincidencias: nunca enviar página/tamaño del listado.
  return solicitarArchivoReporte(`/api/reportes/incidencias/exportar?${params}`, token, formato, signal)
}
