import { useEffect, useState } from "react"
import { Icon } from "./RealUI"
import { consultarToma, tomarIncidencia, type ContextoToma } from "./tiOperations"

const escritura = import.meta.env.VITE_PERMITIR_ASIGNACION_REAL === "true"

export default function RealTake({ token, ticketId, onActualizada }: {token: string; ticketId: string; onActualizada: () => void}) {
  const [contexto, setContexto] = useState<ContextoToma | null>(null)
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [recarga, setRecarga] = useState(0)
  useEffect(() => {
    let vigente = true
    setContexto(null)
    consultarToma(token, ticketId).then(c => { if (vigente) setContexto(c) })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : "No se pudo consultar la toma.") })
    return () => { vigente = false }
  }, [token, ticketId, recarga])

  async function tomar() {
    if (!escritura || !contexto?.puede_tomar || ocupado) return
    setOcupado(true); setError("")
    try {
      const actual = await consultarToma(token, ticketId)
      if (actual.ciclo_actual !== contexto.ciclo_actual || actual.ruta_toma !== contexto.ruta_toma) throw new Error("La incidencia cambió. Actualiza antes de tomarla.")
      await tomarIncidencia(token, ticketId, actual)
      onActualizada()
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo tomar la incidencia."); setRecarga(n => n + 1) }
    finally { setOcupado(false) }
  }
  return <section className="card real-form real-operation" aria-label="Toma autorizada">
    <h3><Icon name="login-headset" />Atender esta incidencia</h3>
    {error && <p role="alert" className="auth-error">{error}</p>}
    {!contexto && !error && <p role="status">Consultando disponibilidad…</p>}
    {contexto && <><p>{contexto.motivo}</p>{contexto.puede_tomar && <>
      <p className="help">La toma te registra como responsable y conserva el historial del ciclo {contexto.ciclo_actual}.</p>
      {!escritura && <p className="notice">La toma está deshabilitada en la configuración actual.</p>}
      <button className="primary" disabled={!escritura || ocupado} onClick={() => void tomar()}>{ocupado ? "Registrando toma…" : "Tomar para mi atención"}</button>
    </>}</>}
  </section>
}
