import { useState } from "react"
import type { IncidenciaReal } from "./api"
import { Badge, Icon } from "./RealUI"

export const fechaRegistro = (valor: string) => new Date(valor).toLocaleString("es-PE", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima",
})

type Props = {
  incidencias: IncidenciaReal[]; cargando: boolean; disponible: boolean; actualizado?: string
  titulo: string; descripcion?: string; limiteVisible?: number; accion?: React.ReactNode
  abrirDetalle: (ticket: IncidenciaReal) => void
}

export default function RealTicketList({ incidencias, cargando, disponible, actualizado, titulo, descripcion, limiteVisible, accion, abrirDetalle }: Props) {
  const [busqueda, setBusqueda] = useState("")
  const [estado, setEstado] = useState("Todos")
  const filtradas = incidencias.filter(t => (estado === "Todos" || estado === t.estado) &&
    `${t.codigo} ${t.asunto} ${t.area_nombre || ""} ${t.prioridad || ""} ${t.responsable_nombre || ""}`.toLocaleLowerCase("es").includes(busqueda.trim().toLocaleLowerCase("es")))
  const visibles = limiteVisible ? filtradas.slice(0, limiteVisible) : filtradas
  return <section className="card table-card" aria-busy={cargando}>
    <div className="section-head"><div><h3>{titulo}</h3><p>{descripcion || "Últimos 50 registros autorizados"}{actualizado && ` · Actualizado a las ${actualizado}`}</p></div>{accion}</div>
    <div className="filters real-filters"><label className="search"><Icon name="search" /><input aria-label="Buscar en los registros cargados" placeholder="Buscar código, asunto, área o responsable…" value={busqueda} onChange={e => setBusqueda(e.target.value)} /></label><select aria-label="Filtrar por estado" value={estado} onChange={e => setEstado(e.target.value)}><option value="Todos">Todos los estados</option><option>Pendiente</option><option>En revisión</option><option>Cerrado</option></select></div>
    {!disponible ? <div className="empty" role="status"><Icon name="clipboard" /><h3>{cargando ? "Consultando incidencias…" : "Listado no disponible"}</h3><p>{cargando ? "Obteniendo los registros autorizados para tu perfil." : "Actualiza para reintentar la consulta."}</p></div> : visibles.length ? <div className="table-wrap" tabIndex={0} role="region" aria-label={titulo}>
      <table className="real-ticket-table"><thead><tr>{["Código", "Asunto", "Área", "Registro", "Prioridad", "Estado", "Responsable", "Acciones"].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead><tbody>{visibles.map(ticket => <tr key={ticket.id}>
        <td><b className="code">{ticket.codigo}</b></td><td title={ticket.asunto}>{ticket.asunto}</td><td>{ticket.area_nombre || "Área no disponible"}</td><td>{fechaRegistro(ticket.fecha_registro)}</td><td><Badge>{ticket.prioridad || "Sin definir"}</Badge></td><td><Badge>{ticket.estado}</Badge></td>
        <td>{ticket.responsable_nombre || (ticket.responsable_tipo === "sin_asignar" ? "Sin asignar" : "No disponible")}{ticket.responsable_tipo === "cierre" && <small className="cell-caption">Cerrado por</small>}</td>
        <td><button className="row-action" aria-label={`Ver detalle de ${ticket.codigo}`} onClick={() => abrirDetalle(ticket)}>Ver<Icon name="arrow" /></button></td>
      </tr>)}</tbody></table>
    </div> : <div className="empty"><Icon name="clipboard" /><h3>{busqueda || estado !== "Todos" ? "Sin coincidencias" : "Todavía no hay incidencias"}</h3><p>{busqueda || estado !== "Todos" ? "Prueba otro filtro dentro de los registros cargados." : "Los registros disponibles para esta vista aparecerán aquí."}</p>{(busqueda || estado !== "Todos") && <button className="outline" onClick={() => { setBusqueda(""); setEstado("Todos") }}>Limpiar filtros</button>}</div>}
    <div className="pagination"><span>{visibles.length} de {filtradas.length} coincidencias en {incidencias.length} registros cargados</span><span>Ordenados por fecha de registro</span></div>
  </section>
}
