import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { solicitarAPI } from "./api"

import { Icon } from "./RealUI"

type Tecnico = { id: string; nombre_completo: string; usuario: string; rol: "ASISTENTE" | "PRACTICANTE" }
type ContextoAsignacion = {
  incidencia_id: string; codigo: string; estado: string; esquema_v4: boolean; ciclo_actual: number
  tecnico_activo: { id: string; nombre_completo: string; rol: string; fecha_asignacion: string } | null
  puede_asignar: boolean; ruta_asignacion: string
}
type Props = { token: string; ticketId: string; onAsignada: () => void; selectorIncidencia?: ReactNode }
const escrituraHabilitada = import.meta.env.VITE_PERMITIR_ASIGNACION_REAL === "true"
const textoError = (e: unknown) => e instanceof Error ? e.message : "No se pudo completar la operación."

export default function RealAssignment({ token, ticketId, onAsignada, selectorIncidencia }: Props) {
  const [contexto, setContexto] = useState<ContextoAsignacion | null>(null)
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [seleccion, setSeleccion] = useState("")
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [recarga, setRecarga] = useState(0)
  useEffect(() => {
    let vigente = true
    setCargando(Boolean(ticketId)); setSeleccion(""); setContexto(null); setTecnicos([])
    if (!ticketId) return
    Promise.all([
      solicitarAPI<ContextoAsignacion>(`/api/incidencias/${encodeURIComponent(ticketId)}/contexto-asignacion`, token),
      solicitarAPI<Tecnico[]>("/api/tecnicos", token),
    ]).then(([datos, lista]) => { if (vigente) { setContexto(datos); setTecnicos(lista) } })
      .catch(e => { if (vigente) setError(textoError(e)) }).finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [ticketId, token, recarga])
  useEffect(() => { setError(""); setMensaje("") }, [ticketId, token])
  const disponible = Boolean(contexto?.puede_asignar) && !contexto?.tecnico_activo
  async function asignar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (cargando || guardando || !escrituraHabilitada || !contexto) return
    if (!disponible || !tecnicos.some(t => t.id === seleccion)) { setError("Selecciona una incidencia disponible y un técnico habilitado."); return }
    setGuardando(true); setError(""); setMensaje("")
    try {
      const id = encodeURIComponent(ticketId)
      const vigente = await solicitarAPI<ContextoAsignacion>(`/api/incidencias/${id}/contexto-asignacion`, token)
      if (!vigente.puede_asignar || vigente.tecnico_activo || vigente.ciclo_actual !== contexto.ciclo_actual || vigente.ruta_asignacion !== contexto.ruta_asignacion) throw new Error("La incidencia cambió. Actualízala antes de asignar.")
      const ruta = vigente.ciclo_actual > 1 ? `/api/v4/incidencias/${id}/asignar` : `/api/asignaciones/${id}/asignar`
      if (vigente.ruta_asignacion !== ruta) throw new Error("La ruta de asignación no coincide con el ciclo actual.")
      const resultado = await solicitarAPI<{ tecnico_id: string }>(ruta, token, { method: "POST", body: JSON.stringify({ tecnico_id: seleccion }) })
      setMensaje(`Asignación registrada a ${tecnicos.find(t => t.id === resultado.tecnico_id)?.nombre_completo || "técnico seleccionado"}.`)
      setSeleccion(""); setRecarga(n => n + 1); onAsignada()
    } catch (fallo) { setError(textoError(fallo)); setRecarga(n => n + 1) }
    finally { setGuardando(false) }
  }
  return <section className="card real-assignment real-form" aria-label="Asignación de técnico">
    <div className="section-head"><div className="institutional-heading"><Icon name="user-add" /><div><h3>{selectorIncidencia ? "Nueva asignación" : "Asignar incidencia"}</h3><p>{selectorIncidencia ? "Selecciona la incidencia y el responsable técnico." : "Se conserva el historial de responsables."}</p></div></div>{contexto && <span className="badge blue">Ciclo {contexto.ciclo_actual}</span>}</div>
    {cargando && <p role="status">Consultando técnicos y responsable…</p>}
    {error && <p role="alert" className="field-error">{error}</p>}{mensaje && <p role="status" className="success">{mensaje}</p>}
    {contexto?.tecnico_activo && <div className="notice"><b>Responsable actual: {contexto.tecnico_activo.nombre_completo}</b><p>Ya existe una asignación activa. No se permiten duplicados.</p></div>}
    {contexto && !contexto.puede_asignar && !contexto.tecnico_activo && <p className="help">La incidencia está en estado {contexto.estado} y no admite una nueva asignación.</p>}
    <form onSubmit={asignar}>
      <div className={selectorIncidencia ? "form-row" : ""}>{selectorIncidencia && <fieldset className="assignment-selection" disabled={guardando}>{selectorIncidencia}</fieldset>}<label>Responsable autorizado<select value={seleccion} onChange={e => setSeleccion(e.target.value)} required disabled={guardando || cargando || !escrituraHabilitada || !disponible}><option value="">{ticketId ? "Seleccione asistente o practicante" : "Seleccione primero una incidencia"}</option>{tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre_completo} · {t.rol}</option>)}</select></label></div>
      {!cargando && ticketId && disponible && !tecnicos.length && <p role="status" className="help">No hay asistentes ni practicantes habilitados.</p>}
      {!escrituraHabilitada && <p className="notice observation-notice">Registro de asignaciones deshabilitado en este entorno hasta autorizar pruebas.</p>}
      <div className="real-actions"><button type="submit" className="primary" disabled={!escrituraHabilitada || !disponible || cargando || guardando || !seleccion}><Icon name="check" />{guardando ? "Registrando…" : "Asignar incidencia"}</button><button type="button" className="outline" disabled={!ticketId || guardando || cargando} onClick={() => { setError(""); setMensaje(""); setRecarga(n => n + 1) }}><Icon name="refresh" />Actualizar disponibilidad</button></div>
    </form>
  </section>
}
