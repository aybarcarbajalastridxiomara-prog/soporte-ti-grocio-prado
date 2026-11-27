import { useEffect, useState } from "react"
import { listarIncidenciasReales, type IncidenciaReal } from "./api"
import RealTicketList, { BannerIncidencias } from "./RealTicketList"
import { Icon } from "./RealUI"

export default function RealWork({ token, abrirDetalle }: { token: string; abrirDetalle: (t: IncidenciaReal) => void }) {
  const [incidencias, setIncidencias] = useState<IncidenciaReal[]>([])
  const [cargando, setCargando] = useState(true)
  const [disponible, setDisponible] = useState(false)
  const [error, setError] = useState("")
  const [recarga, setRecarga] = useState(0)
  useEffect(() => {
    let vigente = true
    setCargando(true); setDisponible(false); setError(""); setIncidencias([])
    listarIncidenciasReales(token, { misAtenciones: true }).then(lista => { if (vigente) { setIncidencias(lista); setDisponible(true) } })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : "No se pudieron consultar tus atenciones.") })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [token, recarga])
  return <div className="incident-directory incident-work">
    <BannerIncidencias titulo="Mis atenciones" descripcion="Gestiona y documenta la atención de tus incidencias asignadas." />
    {error && <p role="alert" className="auth-error">{error}</p>}
    <RealTicketList vistaCompleta={{ modo: "atenciones" }} titulo="Incidencias asignadas a mí" tituloVacio="No tienes incidencias asignadas"
      descripcion="Últimos 50 registros con asignación activa propia" incidencias={incidencias} cargando={cargando} disponible={disponible} abrirDetalle={abrirDetalle}
      accion={<button className="outline" disabled={cargando} onClick={() => setRecarga(n => n + 1)}><Icon name="refresh" />Actualizar</button>} />
  </div>
}
