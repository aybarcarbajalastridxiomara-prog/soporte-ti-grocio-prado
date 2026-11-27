import { useState, type FormEvent, type ReactNode } from "react"
import type { IncidenciaReal } from "./api"
import { Badge, Icon } from "./RealUI"

export const fechaRegistro = (valor: string) => new Date(valor).toLocaleString("es-PE", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima",
})

type Props = {
  incidencias: IncidenciaReal[]; cargando: boolean; disponible: boolean; actualizado?: string
  titulo: string; descripcion?: string; tituloVacio?: string; limiteVisible?: number; accion?: ReactNode
  expandida?: boolean; abrirDetalle: (ticket: IncidenciaReal) => void
}

const filtrosIniciales = { busqueda: "", periodo: "", area: "", responsable: "", prioridad: "", estado: "" }
const estados = ["Pendiente", "En revisión", "Cerrado"]
const fechaLima = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima", dateStyle: "short" })
const prioridadDe = (ticket: IncidenciaReal) => ticket.prioridad || ticket.prioridad_provisional || "Sin definir"
const responsableDe = (ticket: IncidenciaReal) => ticket.responsable_id || (ticket.responsable_tipo === "sin_asignar" ? "sin-asignar" : "")
const nombreResponsable = (ticket: IncidenciaReal) => ticket.responsable_nombre || (ticket.responsable_tipo === "sin_asignar" ? "Sin asignar" : "No disponible")
const normalizar = (valor: string) => valor.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es")
const porPagina = 5

type Filtros = typeof filtrosIniciales
type Columna = "Código" | "Asunto" | "Área" | "Registro" | "Prioridad" | "Estado" | "Responsable" | "Acciones"
const columnasCompactas: Columna[] = ["Código", "Asunto", "Área", "Registro", "Prioridad", "Estado", "Responsable", "Acciones"]
const columnasExpandidas: Columna[] = ["Código", "Asunto", "Área", "Responsable", "Prioridad", "Estado", "Registro", "Acciones"]

function inicioPeriodo(periodo: string) {
  if (!periodo) return ""
  const hoy = new Date(fechaLima.format(new Date()) + "T00:00:00Z")
  hoy.setUTCDate(hoy.getUTCDate() - Number(periodo) + 1)
  return hoy.toISOString().slice(0, 10)
}

export default function RealTicketList({ incidencias, cargando, disponible, actualizado, titulo, descripcion, tituloVacio = "Todavía no hay incidencias", limiteVisible, accion, expandida = false, abrirDetalle }: Props) {
  const [borrador, setBorrador] = useState(filtrosIniciales)
  const [aplicados, setAplicados] = useState(filtrosIniciales)
  const [pagina, setPagina] = useState(1)
  const [orden, setOrden] = useState<{ campo: "Código" | "Registro"; ascendente: boolean }>({ campo: "Registro", ascendente: false })
  const filtros = expandida ? aplicados : borrador
  const filtrando = Object.values(filtros).some(Boolean)
  const desde = inicioPeriodo(filtros.periodo)
  const consulta = normalizar(filtros.busqueda.trim())
  const filtradas = incidencias.filter(t => (!filtros.estado || filtros.estado === t.estado) &&
    (!desde || fechaLima.format(new Date(t.fecha_registro)) >= desde) &&
    (!filtros.area || filtros.area === t.area_id) &&
    (!filtros.responsable || filtros.responsable === responsableDe(t)) &&
    (!filtros.prioridad || filtros.prioridad === prioridadDe(t)) &&
    normalizar(t.codigo + " " + t.asunto + " " + (t.area_nombre || "") + " " + (t.prioridad || t.prioridad_provisional || "") + " " + (t.responsable_nombre || "")).includes(consulta))
  if (expandida) filtradas.sort((a, b) => {
    const resultado = orden.campo === "Código" ? a.codigo.localeCompare(b.codigo, "es", { numeric: true }) :
      new Date(a.fecha_registro).getTime() - new Date(b.fecha_registro).getTime()
    return orden.ascendente ? resultado : -resultado
  })
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina))
  const paginaActual = Math.min(totalPaginas, pagina)
  const inicio = expandida ? (paginaActual - 1) * porPagina : 0
  const visibles = expandida ? filtradas.slice(inicio, inicio + porPagina) : limiteVisible ? filtradas.slice(0, limiteVisible) : filtradas
  const columnas = expandida ? columnasExpandidas : columnasCompactas
  const areas = new Map(incidencias.filter(t => t.area_nombre).map(t => [t.area_id, t.area_nombre]))
  const responsables = new Map(incidencias.filter(t => responsableDe(t)).map(t => [responsableDe(t), nombreResponsable(t)]))
  const prioridades = [...new Set(incidencias.map(prioridadDe))].sort((a, b) => a.localeCompare(b, "es"))

  function cambiar(campo: keyof Filtros, valor: string) {
    setBorrador(anterior => ({ ...anterior, [campo]: valor }))
  }
  function aplicar(evento: FormEvent) {
    evento.preventDefault()
    setAplicados(borrador)
    setPagina(1)
  }
  function limpiar() {
    setBorrador(filtrosIniciales)
    setAplicados(filtrosIniciales)
    setPagina(1)
  }
  function ordenar(campo: "Código" | "Registro") {
    setOrden(anterior => ({ campo, ascendente: anterior.campo === campo ? !anterior.ascendente : campo === "Código" }))
    setPagina(1)
  }

  return <>
    {expandida && <form className="card incident-filters" onSubmit={aplicar} aria-label="Filtros de búsqueda">
      <h3><Icon name="filter" />Filtros de búsqueda</h3>
      <div className="incident-filter-grid">
        <label className="incident-search-label">Buscar<span className="incident-search"><Icon name="search" /><input placeholder="Código, asunto, área o responsable…" value={borrador.busqueda} onChange={e => cambiar("busqueda", e.target.value)} /></span></label>
        <label><span><Icon name="clock" />Período</span><select value={borrador.periodo} onChange={e => cambiar("periodo", e.target.value)}><option value="">Cualquier fecha</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option></select></label>
        <label><span><Icon name="reports" />Área</span><select value={borrador.area} onChange={e => cambiar("area", e.target.value)}><option value="">Todas las áreas</option>{[...areas].map(([id, nombre]) => <option value={id} key={id}>{nombre}</option>)}</select></label>
        <label><span><Icon name="user" />Responsable</span><select value={borrador.responsable} onChange={e => cambiar("responsable", e.target.value)}><option value="">Todos los responsables</option>{[...responsables].map(([id, nombre]) => <option value={id} key={id}>{nombre}</option>)}</select></label>
        <label><span><Icon name="login-ticket" />Prioridad</span><select value={borrador.prioridad} onChange={e => cambiar("prioridad", e.target.value)}><option value="">Todas las prioridades</option>{prioridades.map(p => <option key={p}>{p}</option>)}</select></label>
        <label><span><Icon name="clipboard" />Estado</span><select value={borrador.estado} onChange={e => cambiar("estado", e.target.value)}><option value="">Todos los estados</option>{estados.map(e => <option key={e}>{e}</option>)}</select></label>
        <div className="real-actions incident-filter-actions"><button type="button" className="outline" onClick={limpiar}><Icon name="refresh" />Limpiar</button><button type="submit" className="primary"><Icon name="filter" />Aplicar filtros</button></div>
      </div>
    </form>}
    <section className="card table-card" aria-busy={cargando}>
      <div className="section-head"><div><h3>{expandida && <Icon name="clipboard" />}{titulo}{expandida && disponible && <span className="incident-count">{filtradas.length} {filtradas.length === 1 ? "resultado" : "resultados"}</span>}</h3><p>{descripcion || "Últimos 50 registros autorizados"}{actualizado && (" · Actualizado a las " + actualizado)}</p></div>{accion}</div>
      {!expandida && <div className="filters real-filters"><label className="search"><Icon name="search" /><input aria-label="Buscar en los registros cargados" placeholder="Buscar código, asunto, área o responsable…" value={borrador.busqueda} onChange={e => cambiar("busqueda", e.target.value)} /></label><select aria-label="Filtrar por estado" value={borrador.estado} onChange={e => cambiar("estado", e.target.value)}><option value="">Todos los estados</option>{estados.map(e => <option key={e}>{e}</option>)}</select></div>}
      {!disponible ? <div className="empty" role="status"><Icon name="clipboard" /><h3>{cargando ? "Consultando incidencias…" : "Listado no disponible"}</h3><p>{cargando ? "Obteniendo los registros autorizados para tu perfil." : "Actualiza para reintentar la consulta."}</p></div> : <><div className="table-wrap" tabIndex={0} role="region" aria-label={titulo}>
        <table className="real-ticket-table"><thead><tr>{columnas.map(columna => expandida && (columna === "Código" || columna === "Registro") ?
          <th scope="col" key={columna} aria-sort={orden.campo === columna ? orden.ascendente ? "ascending" : "descending" : "none"}><button type="button" className="incident-sort" onClick={() => ordenar(columna)}>{columna}<span aria-hidden="true">{orden.campo === columna ? orden.ascendente ? "↑" : "↓" : "↕"}</span></button></th> :
          <th scope="col" key={columna}>{columna}</th>)}</tr></thead><tbody>{visibles.map(ticket => {
            const nombre = nombreResponsable(ticket)
            const iniciales = ticket.responsable_nombre?.trim().split(/\s+/).slice(0, 2).map(parte => parte[0]).join("").toUpperCase()
            const celdas: Record<Columna, ReactNode> = {
              Código: <b className="code">{ticket.codigo}</b>,
              Asunto: <span className="incident-subject" title={ticket.asunto}>{expandida && <Icon name="login-ticket" />}{ticket.asunto}</span>,
              Área: ticket.area_nombre || "Área no disponible",
              Registro: fechaRegistro(ticket.fecha_registro),
              Prioridad: <><span data-prioridad={expandida ? prioridadDe(ticket) : undefined}><Badge>{prioridadDe(ticket)}</Badge></span>{!ticket.prioridad && ticket.prioridad_revision_pendiente && <small className="cell-caption">Provisional · revisión JEFE</small>}</>,
              Estado: <span className={expandida && ticket.estado === "En revisión" ? "incident-in-review" : undefined}><Badge>{ticket.estado}</Badge></span>,
              Responsable: <><span className="incident-owner">{expandida && <span className="incident-owner-avatar" aria-hidden="true">{iniciales || <Icon name="users" />}</span>}{nombre}</span>{ticket.responsable_tipo === "cierre" && <small className="cell-caption">Cerrado por</small>}</>,
              Acciones: <button className="row-action" aria-label={"Ver detalle de " + ticket.codigo} onClick={() => abrirDetalle(ticket)}>{expandida && <Icon name="login-eye" />}Ver<Icon name="arrow" /></button>,
            }
            return <tr key={ticket.id}>{columnas.map(columna => <td key={columna}>{celdas[columna]}</td>)}</tr>
          })}</tbody></table>
      </div>{!visibles.length && <div className="empty" role="status"><Icon name="clipboard" /><h3>{filtrando ? "Sin coincidencias" : tituloVacio}</h3><p>{filtrando ? "Prueba otro filtro dentro de los registros cargados." : "Los registros disponibles para esta vista aparecerán aquí."}</p>{filtrando && <button className="outline" onClick={limpiar}>Limpiar filtros</button>}</div>}</>}
      <div className="pagination incident-pagination">{expandida ? <>
        <span role="status">{filtradas.length ? "Mostrando " + (inicio + 1) + "–" + (inicio + visibles.length) + " de " + filtradas.length + " resultados" : "0 resultados"} · {incidencias.length} registros cargados</span>
        {totalPaginas > 1 && <div className="real-actions">
          <button className="outline" type="button" aria-label="Página anterior" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)}>‹</button>
          {Array.from({ length: totalPaginas }, (_, indice) => indice + 1).map(n => <button key={n} type="button" className={n === paginaActual ? "primary" : "outline"} aria-label={"Página " + n} aria-current={n === paginaActual ? "page" : undefined} onClick={() => setPagina(n)}>{n}</button>)}
          <button className="outline" type="button" aria-label="Página siguiente" disabled={paginaActual === totalPaginas} onClick={() => setPagina(paginaActual + 1)}>›</button>
        </div>}
      </> : <><span>{visibles.length} de {filtradas.length} coincidencias en {incidencias.length} registros cargados</span><span>Ordenados por fecha de registro</span></>}</div>
    </section>
  </>
}
