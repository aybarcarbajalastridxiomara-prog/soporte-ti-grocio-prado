import { useEffect, useState } from "react"
import { solicitarAPI } from "./api"

type Informe = {
  codigo_incidencia: string; asunto: string; descripcion_problema: string; estado: string
  prioridad: string | null; fecha_registro: string; fecha_cierre: string | null
  duracion_total_registrada_minutos: number
  intervenciones: {id: string; diagnostico: string; acciones_realizadas: string; solucion_aplicada: string | null; duracion_minutos: number | null; fecha_registro: string}[]
}

export default function RealTechnicalReport({ token, ticketId }: {token: string; ticketId: string}) {
  const [informe, setInforme] = useState<Informe | null>(null)
  const [error, setError] = useState("")
  const [recarga, setRecarga] = useState(0)
  useEffect(() => {
    let vigente = true
    setInforme(null); setError("")
    solicitarAPI<Informe>(`/api/incidencias/${encodeURIComponent(ticketId)}/informe-tecnico/borrador`, token)
      .then(i => { if (vigente) setInforme(i) }).catch(e => { if (vigente) setError(e instanceof Error ? e.message : "No se pudo preparar el informe.") })
    return () => { vigente = false }
  }, [token, ticketId, recarga])
  return <section className="card real-form real-operation" aria-label="Informe técnico">
    <div className="section-head"><div><h3>Informe técnico de la incidencia</h3><p>Borrador de consulta sujeto a participación y permisos técnicos.</p></div><button className="outline" onClick={() => setRecarga(n => n + 1)}>Actualizar informe</button></div>
    {error && <p role="alert" className="auth-error">{error}</p>}
    {!informe && !error && <p role="status">Preparando informe…</p>}
    {informe && <><h4>{informe.codigo_incidencia} · {informe.asunto}</h4><p>{informe.descripcion_problema}</p>
      <p>Estado: <b>{informe.estado}</b> · Prioridad oficial: <b>{informe.prioridad || "Pendiente de evaluación"}</b></p>
      <p>Duración total registrada: <b>{informe.duracion_total_registrada_minutos} minutos</b></p>
      {informe.intervenciones.map(i => <article className="notice" key={i.id}><h4>{i.diagnostico}</h4><p>{i.acciones_realizadas}</p><p>Solución: {i.solucion_aplicada || "No registrada"}</p><p>Duración: {i.duracion_minutos === null ? "No registrada" : `${i.duracion_minutos} minutos`}</p></article>)}
      <p className="help">Consulta de actuaciones técnicas registradas. La firma y emisión formal de este informe técnico siguen pendientes.</p>
    </>}
  </section>
}
