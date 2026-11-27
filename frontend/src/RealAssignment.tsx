import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { solicitarAPI } from "./api"
import { guardarAsignacion, type ContextoAsignacion } from "./assignmentOperations"

import { Icon } from "./RealUI"

type Tecnico = { id: string; nombre_completo: string; usuario: string; rol: "ASISTENTE" | "PRACTICANTE" }
type Props = { token: string; ticketId: string; onAsignada: () => void; selectorIncidencia?: ReactNode }
// El operador puede habilitar solo asignación/reasignación sin activar prioridad o autotoma.
const permisoGestion = import.meta.env.VITE_PERMITIR_GESTION_ASIGNACIONES_REAL
const escrituraHabilitada = permisoGestion === undefined
  ? import.meta.env.VITE_PERMITIR_ASIGNACION_REAL === "true" : permisoGestion === "true"
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
  const [motivo, setMotivo] = useState("")
  useEffect(() => {
    let vigente = true
    setCargando(Boolean(ticketId)); setSeleccion(""); setMotivo(""); setContexto(null); setTecnicos([])
    if (!ticketId) return
    Promise.all([
      solicitarAPI<ContextoAsignacion>(`/api/incidencias/${encodeURIComponent(ticketId)}/contexto-asignacion`, token),
      solicitarAPI<Tecnico[]>("/api/tecnicos", token),
    ]).then(([datos, lista]) => { if (vigente) { setContexto(datos); setTecnicos(lista) } })
      .catch(e => { if (vigente) setError(textoError(e)) }).finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [ticketId, token, recarga])
  useEffect(() => { setError(""); setMensaje("") }, [ticketId, token])
  const reasignando = Boolean(contexto?.tecnico_activo)
  const disponible = contexto?.permisos_verificados === true && (reasignando
    ? contexto.puede_reasignar && Boolean(contexto.tecnico_activo?.asignacion_id)
    : contexto.puede_asignar)
  const elegibles = tecnicos.filter(t => t.id !== contexto?.tecnico_activo?.id)
  async function asignar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (cargando || guardando || !escrituraHabilitada || !contexto) return
    if (!disponible || !elegibles.some(t => t.id === seleccion)) { setError("Selecciona una incidencia disponible y un técnico habilitado."); return }
    if (reasignando && motivo.trim().length < 5) { setError("Indica un motivo de reasignación de al menos cinco caracteres."); return }
    setGuardando(true); setError(""); setMensaje("")
    try {
      const resultado = await guardarAsignacion(token, ticketId, contexto, seleccion, motivo)
      setMensaje(`${reasignando ? "Reasignación" : "Asignación"} registrada a ${tecnicos.find(t => t.id === resultado.tecnico_id)?.nombre_completo || "técnico seleccionado"}.`)
      setSeleccion(""); setRecarga(n => n + 1); onAsignada()
    } catch (fallo) { setError(textoError(fallo)); setRecarga(n => n + 1) }
    finally { setGuardando(false) }
  }
  return <section className="card real-assignment real-form" aria-label="Asignación de técnico">
    <div className="section-head"><div className="institutional-heading"><Icon name="user-add" /><div><h3>{reasignando ? "Reasignar incidencia" : selectorIncidencia ? "Nueva asignación" : "Asignar incidencia"}</h3><p>{selectorIncidencia ? "Selecciona la incidencia y el responsable técnico." : "Se conserva el historial de responsables."}</p></div></div>{contexto && <span className="badge blue">Ciclo {contexto.ciclo_actual}</span>}</div>
    {cargando && <p role="status">Consultando técnicos y responsable…</p>}
    {error && <p role="alert" className="field-error">{error}</p>}{mensaje && <p role="status" className="success">{mensaje}</p>}
    {contexto?.tecnico_activo && <div className="notice"><b>Responsable actual: {contexto.tecnico_activo.nombre_completo}</b><p>La reasignación finaliza la asignación actual y conserva su historial.</p></div>}
    {contexto && !contexto.permisos_verificados && <p role="status" className="notice observation-notice">El backend no confirmó los permisos PostgreSQL y RLS para asignar. Contacta al operador.</p>}
    {contexto && !contexto.puede_asignar && !contexto.tecnico_activo && <p className="help">La incidencia está en estado {contexto.estado} y no admite una nueva asignación.</p>}
    <form onSubmit={asignar}>
      <div className={selectorIncidencia ? "form-row" : ""}>{selectorIncidencia && <fieldset className="assignment-selection" disabled={guardando}>{selectorIncidencia}</fieldset>}<label>Responsable autorizado<select value={seleccion} onChange={e => setSeleccion(e.target.value)} required disabled={guardando || cargando || !escrituraHabilitada || !disponible}><option value="">{ticketId ? "Seleccione asistente o practicante" : "Seleccione primero una incidencia"}</option>{elegibles.map(t => <option key={t.id} value={t.id}>{t.nombre_completo} · {t.rol}</option>)}</select></label></div>
      {reasignando && <label>Motivo de la reasignación<textarea value={motivo} onChange={e => setMotivo(e.target.value)} minLength={5} maxLength={500} required disabled={!escrituraHabilitada || !disponible || guardando || cargando} /></label>}
      {!cargando && ticketId && disponible && !elegibles.length && <p role="status" className="help">No hay otros asistentes ni practicantes habilitados disponibles.</p>}
      {!escrituraHabilitada && <p className="notice observation-notice">Registro de asignaciones deshabilitado en este entorno hasta autorizar pruebas.</p>}
      <div className="real-actions"><button type="submit" className="primary" disabled={!escrituraHabilitada || !disponible || cargando || guardando || !seleccion || (reasignando && motivo.trim().length < 5)}><Icon name="check" />{guardando ? "Registrando…" : reasignando ? "Guardar reasignación" : "Asignar incidencia"}</button><button type="button" className="outline" disabled={!ticketId || guardando || cargando} onClick={() => { setError(""); setMensaje(""); setRecarga(n => n + 1) }}><Icon name="refresh" />Actualizar disponibilidad</button></div>
    </form>
  </section>
}
