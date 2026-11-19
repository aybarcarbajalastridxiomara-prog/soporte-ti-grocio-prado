import { useEffect, useState, type FormEvent } from "react"
import type { Rol } from "./api"
import { consultarPrioridad, establecerPrioridad, type ContextoPrioridad, type Prioridad } from "./tiOperations"

const escritura = import.meta.env.VITE_PERMITIR_ASIGNACION_REAL === "true"

export default function RealPriority({ token, ticketId, rol, onActualizada }: {token: string; ticketId: string; rol: Rol; onActualizada: () => void}) {
  const [contexto, setContexto] = useState<ContextoPrioridad | null>(null)
  const [prioridad, setPrioridad] = useState<Prioridad | "">("")
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [recarga, setRecarga] = useState(0)
  useEffect(() => {
    let vigente = true
    setContexto(null)
    consultarPrioridad(token, ticketId).then(c => {
      if (!vigente) return
      setContexto(c)
      setPrioridad((["Alta", "Media", "Baja"].includes(c.oficial || "") ? c.oficial : c.provisional || c.sugerida || "") as Prioridad | "")
    }).catch(e => { if (vigente) setError(e instanceof Error ? e.message : "No se pudo consultar la prioridad.") })
    return () => { vigente = false }
  }, [token, ticketId, recarga])
  const autorizado = (rol === "JEFE" || rol === "ASISTENTE") && contexto?.puede_establecer
  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!escritura || !autorizado || !contexto || !prioridad || ocupado) return
    setOcupado(true); setError("")
    try {
      const actual = await consultarPrioridad(token, ticketId)
      if (actual.version !== contexto.version || actual.ciclo_actual !== contexto.ciclo_actual || actual.oficial !== contexto.oficial || actual.operacion !== contexto.operacion) {
        throw new Error("La prioridad o la autorización cambiaron. Actualiza antes de continuar.")
      }
      await establecerPrioridad(token, ticketId, contexto, prioridad, motivo)
      setMotivo(""); onActualizada()
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo registrar la prioridad."); setRecarga(n => n + 1) }
    finally { setOcupado(false) }
  }
  return <section className="card real-form real-operation" aria-label="Evaluación de prioridad">
    <h3>Prioridad de la incidencia</h3>
    {error && <p role="alert" className="auth-error">{error}</p>}
    {!contexto && !error && <p role="status">Consultando evaluación…</p>}
    {contexto && <>
      <div className="form-row"><p>Oficial: <strong>{contexto.oficial || "Pendiente de evaluación"}</strong></p><p>Sugerida por impacto: <strong>{contexto.sugerida || "Pendiente de evaluación"}</strong></p></div>
      <p className="help">La sugerencia es orientativa; no establece la prioridad oficial.</p>
      {contexto.revision_pendiente && <div className="notice" role="status"><b>Provisional: {contexto.provisional} · pendiente de revisión del JEFE</b><p>{contexto.justificacion}</p></div>}
      <p>{contexto.motivo}</p>
      {autorizado && <form onSubmit={guardar}><fieldset disabled={ocupado || !escritura}>
        <label>Prioridad a {contexto.operacion === "provisional" ? "proponer" : "confirmar"}<select required value={prioridad} onChange={e => setPrioridad(e.target.value as Prioridad | "")}><option value="">Seleccione</option><option>Alta</option><option>Media</option><option>Baja</option></select></label>
        <label>Justificación *<textarea required minLength={5} maxLength={1000} rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
        <button className="primary" disabled={!prioridad || motivo.trim().length < 5} type="submit">{ocupado ? "Registrando…" : contexto.operacion === "provisional" ? "Registrar prioridad provisional" : "Confirmar prioridad oficial"}</button>
      </fieldset>{!escritura && <p className="notice">La edición de prioridad está deshabilitada en la configuración actual.</p>}</form>}
    </>}
  </section>
}
