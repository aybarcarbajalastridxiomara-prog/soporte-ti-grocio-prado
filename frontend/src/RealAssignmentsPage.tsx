import { useEffect, useState } from "react"
import { solicitarAPI, type IncidenciaReal } from "./api"
import RealAssignment from "./RealAssignment"
import RealTicketList, { fechaRegistro } from "./RealTicketList"
import { Icon } from "./RealUI"

type Evento = { id: string; accion: string; descripcion: string; fecha_registro: string }
type Props = { token: string; incidencias: IncidenciaReal[]; cargando: boolean; actualizado: string; actualizar: () => void; abrirDetalle: (t: IncidenciaReal) => void }
export default function RealAssignmentsPage({ token, incidencias, cargando, actualizado, actualizar, abrirDetalle }: Props) {
  const [seleccion, setSeleccion] = useState("")
  const [eventos, setEventos] = useState<Evento[]>([])
  const [error, setError] = useState("")
  const [recarga, setRecarga] = useState(0)
  const [consultando, setConsultando] = useState(false)
  useEffect(() => {
    let vigente = true
    setEventos([]); setError(""); setConsultando(Boolean(seleccion))
    if (!seleccion) return
    solicitarAPI<Evento[]>(`/api/incidencias/${encodeURIComponent(seleccion)}/historial`, token)
      .then(lista => { if (vigente) setEventos(lista.filter(e => /ASIGNACION|TOMA/.test(e.accion))) })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : "No se pudo consultar el historial.") })
      .finally(() => { if (vigente) setConsultando(false) })
    return () => { vigente = false }
  }, [seleccion, token, recarga])
  return <div className="real-stack"><div className="welcome"><div><h2>Asignación de incidencias</h2><p>Seleccione una incidencia y un responsable autorizado.</p></div><button className="outline" disabled={cargando} onClick={actualizar}><Icon name="refresh" />Actualizar</button></div>
    <RealAssignment token={token} ticketId={seleccion} onAsignada={() => { actualizar(); setRecarga(n => n + 1) }} selectorIncidencia={<label>Incidencia<select aria-label="Seleccionar incidencia para asignación" value={seleccion} onChange={e => setSeleccion(e.target.value)}><option value="">Seleccione una incidencia</option>{incidencias.filter(t => t.estado !== "Cerrado").map(t => <option key={t.id} value={t.id}>{t.codigo} · {t.asunto}</option>)}</select></label>} />
    {seleccion && <section className="card"><h3>Historial de asignaciones</h3>{consultando ? <p role="status">Consultando historial…</p> : error ? <p role="alert" className="field-error">{error}</p> : eventos.length ? <ol className="real-history">{eventos.map(e => <li key={e.id}><b>{e.accion}</b><p>{e.descripcion}</p><small>{fechaRegistro(e.fecha_registro)}</small></li>)}</ol> : <p className="help">No hay asignaciones registradas para esta incidencia.</p>}</section>}
    <RealTicketList titulo="Incidencias y responsables" incidencias={incidencias} cargando={cargando} disponible={Boolean(actualizado)} actualizado={actualizado} abrirDetalle={abrirDetalle} />
  </div>
}
