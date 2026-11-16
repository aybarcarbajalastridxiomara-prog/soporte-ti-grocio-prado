import type { IncidenciaReal, PerfilReal, ResumenReal } from "./api"
import type { VistaReal } from "./RealApp"
import { Icon } from "./RealUI"
import RealTicketList from "./RealTicketList"

type Props = {
  vista: VistaReal; perfil: PerfilReal; incidencias: IncidenciaReal[]; resumen: ResumenReal | null
  cargando: boolean; actualizado: string; actualizar: () => void
  navegar: (vista: VistaReal) => void; abrirDetalle: (ticket: IncidenciaReal) => void
}
export default function RealDashboard({ vista, perfil, incidencias, resumen, cargando, actualizado, actualizar, navegar, abrirDetalle }: Props) {
  const representante = perfil.rol === "REPRESENTANTE"
  const panel = vista === "dashboard"
  const tarjetas = [
    { numero: resumen?.total, etiqueta: "Total de incidencias", color: "blue", icono: "clipboard" },
    { numero: resumen?.pendientes, etiqueta: "Pendientes", color: "amber", icono: "clock" },
    { numero: resumen?.en_revision, etiqueta: "En revisión", color: "blue", icono: "tool" },
    { numero: resumen?.cerradas, etiqueta: "Cerradas", color: "green", icono: "check" },
  ]
  return <>
    <div className="welcome"><div><h2>{panel ? representante ? `Resumen de ${perfil.area_nombre || "mi área"}` : "Panorama operativo de Sistemas" : representante ? "Incidencias de mi área" : "Listado general de incidencias"}</h2><p>{representante ? "Revise y registre las incidencias de su área." : "Seguimiento consolidado de incidencias municipales."}</p></div>
      <div className="real-actions"><button className="outline" onClick={actualizar} disabled={cargando}><Icon name="refresh" />{cargando ? "Actualizando…" : "Actualizar"}</button>{representante && <button className="primary" onClick={() => navegar("registro")}><Icon name="plus" />Registrar incidencia</button>}</div>
    </div>
    {panel && <><div className="kpis four" aria-label="Indicadores generales">{tarjetas.map(t => <article className="kpi" key={t.etiqueta}><span className={`kpi-icon ${t.color}`}><Icon name={t.icono} /></span><div><b>{t.numero ?? "—"}</b><p>{t.etiqueta}</p></div></article>)}</div><p className="help real-scope">Conteos completos de {representante ? "tu área" : "las incidencias autorizadas"}, obtenidos de PostgreSQL. {resumen === null && "Indicadores no disponibles."}</p></>}
    <RealTicketList incidencias={incidencias} cargando={cargando} disponible={Boolean(actualizado)} actualizado={actualizado} titulo={panel ? "Actividad reciente" : "Incidencias registradas"} limiteVisible={panel ? 5 : undefined} abrirDetalle={abrirDetalle} accion={panel && <button className="text-button" onClick={() => navegar("incidencias")}>Ver todas<Icon name="arrow" /></button>} />
  </>
}
