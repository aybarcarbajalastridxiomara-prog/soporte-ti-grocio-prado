import { useState } from "react"
import type { IncidenciaReal, ResumenReal } from "./api"
import type { VistaReal } from "./RealApp"
import { Badge, Icon } from "./RealUI"

type Props = {
  vista: VistaReal
  representante: boolean
  incidencias: IncidenciaReal[]
  resumen: ResumenReal | null
  cargando: boolean
  actualizado: string
  actualizar: () => void
  navegar: (vista: VistaReal) => void
  abrirDetalle: (ticket: IncidenciaReal) => void
}

export default function RealDashboard({ vista, representante, incidencias, resumen, cargando, actualizado, actualizar, navegar, abrirDetalle }: Props) {
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState("Todos")
  const filtradas = incidencias.filter((ticket) =>
    (estado === "Todos" || ticket.estado === estado) &&
    `${ticket.codigo} ${ticket.asunto} ${ticket.prioridad || ""}`.toLocaleLowerCase("es").includes(busqueda.trim().toLocaleLowerCase("es")),
  )
  const visibles = vista === "dashboard" ? filtradas.slice(0, 5) : filtradas
  const tarjetas = [
    { numero: resumen?.total, etiqueta: "Registros disponibles", color: "blue", icono: "clipboard" },
    { numero: resumen?.pendientes, etiqueta: "Pendientes", color: "amber", icono: "clock" },
    { numero: resumen?.en_revision, etiqueta: "En revisión", color: "blue", icono: "tool" },
    { numero: resumen?.cerradas, etiqueta: "Cerradas", color: "green", icono: "check" },
  ]
  return <>
    <div className="welcome">
      <div><p className="real-eyebrow">MUNICIPALIDAD DISTRITAL DE GROCIO PRADO</p>
        <h2>{vista === "dashboard" ? representante ? "El estado de tu área, en un vistazo" : "Panorama operativo de Sistemas" : vista === "asignaciones" ? "Organiza la atención de incidencias" : vista === "atencion" ? "Seguimiento de la atención técnica" : representante ? "Incidencias de mi área" : "Listado general de incidencias"}</h2>
        <p>{vista === "asignaciones" ? "Abre una incidencia para consultar o registrar su asignación." : vista === "atencion" ? "Abre el detalle para consultar intervenciones y las acciones autorizadas." : "Consulta y da seguimiento a las solicitudes de soporte tecnológico."}</p>
      </div>
      <div className="real-actions"><button className="outline" onClick={actualizar} disabled={cargando}><Icon name="refresh" />{cargando ? "Actualizando…" : "Actualizar"}</button>{representante && <button className="primary" onClick={() => navegar("registro")}><Icon name="plus" />Registrar incidencia</button>}</div>
    </div>
    {vista === "dashboard" && <>
      <div className="kpis four" aria-label="Indicadores generales">{tarjetas.map((tarjeta) => <article className="kpi" key={tarjeta.etiqueta}><span className={`kpi-icon ${tarjeta.color}`}><Icon name={tarjeta.icono} /></span><div><b>{tarjeta.numero ?? "—"}</b><p>{tarjeta.etiqueta}</p></div></article>)}</div>
      <p className="help real-scope">Conteos completos de {representante ? "tu área" : "las incidencias autorizadas"}, obtenidos de PostgreSQL. {resumen === null && "Indicadores no disponibles."}</p>
    </>}
    <section className="card table-card" aria-busy={cargando}>
      <div className="section-head"><div><h3>{vista === "dashboard" ? "Actividad reciente" : vista === "asignaciones" ? "Incidencias para consultar asignación" : vista === "atencion" ? "Incidencias para consultar atención" : "Incidencias registradas"}</h3><p>Últimos 50 registros autorizados · {actualizado ? `Listado actualizado a las ${actualizado}` : "Sin actualización disponible"}</p></div>{vista === "dashboard" && <button className="text-button" onClick={() => navegar("incidencias")}>Ver listado<Icon name="arrow" /></button>}</div>
      <div className="filters real-filters"><label className="search"><Icon name="search" /><input aria-label="Buscar por código, asunto o prioridad en los últimos 50 registros" placeholder="Buscar código, asunto o prioridad…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></label><select aria-label="Filtrar por estado" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="Todos">Todos los estados</option><option>Pendiente</option><option>En revisión</option><option>Cerrado</option></select></div>
      {!actualizado ? <div className="empty" role="status"><Icon name="clipboard" /><h3>{cargando ? "Consultando incidencias…" : "Listado no disponible"}</h3><p>{cargando ? "Obteniendo los registros autorizados para tu perfil." : "Actualiza el panel para reintentar la consulta."}</p></div> : visibles.length ? <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de incidencias">
        <table className="real-ticket-table"><thead><tr><th scope="col">Código</th><th scope="col">Asunto</th><th scope="col">Registro</th><th scope="col">Prioridad</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
          <tbody>{visibles.map((ticket) => <tr key={ticket.id}><td><b className="code">{ticket.codigo}</b></td><td title={ticket.asunto}>{ticket.asunto}</td><td>{new Date(ticket.fecha_registro).toLocaleDateString("es-PE", { timeZone: "America/Lima" })}</td><td><Badge>{ticket.prioridad || "Sin definir"}</Badge></td><td><Badge>{ticket.estado}</Badge></td><td><button className="row-action" aria-label={`Ver detalle de ${ticket.codigo}`} onClick={() => abrirDetalle(ticket)}>{vista === "asignaciones" ? "Ver asignación" : vista === "atencion" ? "Ver atención" : "Ver detalle"}<Icon name="arrow" /></button></td></tr>)}</tbody>
        </table>
      </div> : <div className="empty"><Icon name="clipboard" /><h3>{busqueda || estado !== "Todos" ? "Sin coincidencias" : "Todavía no hay incidencias"}</h3><p>{busqueda || estado !== "Todos" ? "Prueba otro código, asunto o estado dentro de los registros cargados." : "Las solicitudes disponibles para tu perfil aparecerán aquí."}</p>{(busqueda || estado !== "Todos") && <button className="outline" onClick={() => { setBusqueda(""); setEstado("Todos") }}>Limpiar filtros</button>}</div>}
      <div className="pagination"><span>{visibles.length} de {filtradas.length} coincidencias en {incidencias.length} registros cargados</span><span>Ordenados por fecha de registro</span></div>
    </section>
  </>
}
