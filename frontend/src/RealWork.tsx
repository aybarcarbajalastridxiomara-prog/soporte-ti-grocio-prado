import { useEffect, useState } from "react"
import { listarIncidenciasReales, type IncidenciaReal } from "./api"
import RealTicketList from "./RealTicketList"
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
  return <><div className="welcome"><div><h2>Mis atenciones</h2><p>Seleccione una de sus incidencias activas para documentar la atención.</p></div><button className="outline" disabled={cargando} onClick={() => setRecarga(n => n + 1)}><Icon name="refresh" />Actualizar</button></div>{error && <p role="alert" className="auth-error">{error}</p>}<RealTicketList titulo="Incidencias asignadas a mí" tituloVacio="No tienes incidencias asignadas" descripcion="Últimos 50 registros con asignación activa propia, consultados en el servidor" incidencias={incidencias} cargando={cargando} disponible={disponible} abrirDetalle={abrirDetalle} /></>
}
