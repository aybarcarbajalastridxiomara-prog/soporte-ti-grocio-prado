import { useState, type FormEvent, type ReactNode } from "react"
import type { IncidenciaReal, Rol } from "./api"
import { Badge, Icon } from "./RealUI"

export const fechaRegistro = (valor: string) => new Date(valor).toLocaleString("es-PE", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima",
})

type Props = {
  incidencias: IncidenciaReal[]; cargando: boolean; disponible: boolean; actualizado?: string
  titulo: string; descripcion?: string; tituloVacio?: string; limiteVisible?: number; accion?: ReactNode
  vistaCompleta?: { modo: "incidencias"; rol: Rol; usuarioId: string } | { modo: "atenciones" | "asignaciones" }
  abrirDetalle: (ticket: IncidenciaReal) => void
}

const filtrosIniciales = { busqueda: "", periodo: "", area: "", responsable: "", asignacion: "", prioridad: "", estado: "" }
const estados = ["Pendiente", "En revisión", "Cerrado"]
const fechaLima = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima", dateStyle: "short" })
const prioridadDe = (ticket: IncidenciaReal) => ticket.prioridad || ticket.prioridad_provisional || "Sin definir"
const responsableDe = (ticket: IncidenciaReal) => ticket.responsable_id || (ticket.responsable_tipo === "sin_asignar" ? "sin-asignar" : "")
const nombreResponsable = (ticket: IncidenciaReal) => ticket.responsable_nombre || (ticket.responsable_tipo === "sin_asignar" ? "Sin asignar" : "No disponible")
const normalizar = (valor: string) => valor.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("es")
const porPagina = 5

type Filtros = typeof filtrosIniciales
type Ordenable = "Código" | "Registro" | "Asignación"
type Columna = Ordenable | "Asunto" | "Área" | "Prioridad" | "Estado" | "Responsable" | "Tiempo de atención" | "Acciones"
const columnasCompactas: Columna[] = ["Código", "Asunto", "Área", "Registro", "Prioridad", "Estado", "Responsable", "Acciones"]
const columnasExpandidas: Columna[] = ["Código", "Asunto", "Área", "Responsable", "Prioridad", "Estado", "Registro", "Acciones"]
const columnasAtenciones: Columna[] = ["Código", "Asunto", "Área", "Prioridad", "Estado", "Asignación", "Tiempo de atención", "Acciones"]

function inicioPeriodo(periodo: string) {
  if (!periodo) return ""
  const hoy = new Date(fechaLima.format(new Date()) + "T00:00:00Z")
  hoy.setUTCDate(hoy.getUTCDate() - Number(periodo) + 1)
  return hoy.toISOString().slice(0, 10)
}

function tiempoRegistrado(minutos: number) {
  return minutos < 60 ? minutos + " min" : Math.floor(minutos / 60) + " h " + minutos % 60 + " min"
}

export function BannerIncidencias({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return <section className="real-shell-greeting incident-hero">
    <div><h2>{titulo}</h2><p>{descripcion}</p></div>
    <div className="real-dashboard-banner-art" aria-hidden="true"><span className="real-access-laptop"><Icon name="login-headset" /></span></div>
  </section>
}

export default function RealTicketList({ incidencias, cargando, disponible, actualizado, titulo, descripcion, tituloVacio = "Todavía no hay incidencias", limiteVisible, accion, vistaCompleta, abrirDetalle }: Props) {
  const expandida = Boolean(vistaCompleta)
  const atenciones = vistaCompleta?.modo === "atenciones"
  const asignaciones = vistaCompleta?.modo === "asignaciones"
  const listado = vistaCompleta?.modo === "incidencias" ? vistaCompleta : undefined
  const jefe = listado?.rol === "JEFE" || asignaciones
  const representante = listado?.rol === "REPRESENTANTE"
  const tecnico = listado?.rol === "ASISTENTE" || listado?.rol === "PRACTICANTE"
  const tituloFiltros = atenciones ? "Filtros de atención" : "Filtros de búsqueda"
  const prioridadVisible = representante ? (t: IncidenciaReal) => t.prioridad || "Sin definir" : prioridadDe
  const [borrador, setBorrador] = useState(filtrosIniciales)
  const [aplicados, setAplicados] = useState(filtrosIniciales)
  const [pagina, setPagina] = useState(1)
  const [orden, setOrden] = useState<{ campo: Ordenable; ascendente: boolean }>({ campo: atenciones ? "Asignación" : "Registro", ascendente: false })
  const filtros = expandida && !asignaciones ? aplicados : borrador
  const filtrando = Object.values(filtros).some(Boolean)
  const desde = inicioPeriodo(filtros.periodo)
  const consulta = normalizar(filtros.busqueda.trim())
  const filtradas = incidencias.filter(t => {
    const fecha = atenciones ? t.fecha_asignacion : t.fecha_registro
    const palabras = [t.codigo, t.asunto, !representante && t.area_nombre, !atenciones && !tecnico && !representante && t.responsable_nombre]
    if (!expandida) palabras.push(prioridadDe(t))
    return (!filtros.estado || filtros.estado === t.estado) &&
      (!desde || Boolean(fecha && fechaLima.format(new Date(fecha)) >= desde)) &&
      (!filtros.area || filtros.area === t.area_id) &&
      (!filtros.responsable || filtros.responsable === responsableDe(t)) &&
      (!filtros.asignacion ||
        (filtros.asignacion === "propia" && t.responsable_tipo === "activo" && t.responsable_id === listado?.usuarioId) ||
        (filtros.asignacion === "cierre" && t.responsable_tipo === "cierre" && t.responsable_id === listado?.usuarioId) ||
        (filtros.asignacion === "libre" && t.responsable_tipo === "sin_asignar")) &&
      (!filtros.prioridad || filtros.prioridad === prioridadVisible(t)) &&
      normalizar(palabras.filter(Boolean).join(" ")).includes(consulta)
  })
  if (expandida) filtradas.sort((a, b) => {
    const fechaOrden = (t: IncidenciaReal) => Date.parse((orden.campo === "Asignación" ? t.fecha_asignacion : t.fecha_registro) ?? "") || 0
    const resultado = orden.campo === "Código" ? a.codigo.localeCompare(b.codigo, "es", { numeric: true }) :
      fechaOrden(a) - fechaOrden(b)
    return orden.ascendente ? resultado : -resultado
  })
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina))
  const paginaActual = Math.min(totalPaginas, pagina)
  const inicio = expandida ? (paginaActual - 1) * porPagina : 0
  const visibles = expandida ? filtradas.slice(inicio, inicio + porPagina) : limiteVisible ? filtradas.slice(0, limiteVisible) : filtradas
  const columnas = atenciones ? columnasAtenciones : expandida ? columnasExpandidas : columnasCompactas
  const areas = new Map(incidencias.filter(t => t.area_nombre).map(t => [t.area_id, t.area_nombre]))
  const responsables = new Map(incidencias.filter(t => responsableDe(t)).map(t => [responsableDe(t), nombreResponsable(t)]))
  const prioridades = [...new Set(incidencias.map(prioridadVisible))].sort((a, b) => a.localeCompare(b, "es"))

  function cambiar(campo: keyof Filtros, valor: string) {
    setBorrador(anterior => ({ ...anterior, [campo]: valor }))
    if (asignaciones) setPagina(1)
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
  function ordenar(campo: Ordenable) {
    setOrden(anterior => ({ campo, ascendente: anterior.campo === campo ? !anterior.ascendente : campo === "Código" }))
    setPagina(1)
  }

  return <>
    {expandida && !asignaciones && <form className="card incident-filters" onSubmit={aplicar} aria-label={tituloFiltros}>
      <h3><Icon name="filter" />{tituloFiltros}</h3>
      <div className="incident-filter-grid">
        <label className="incident-search-label">Buscar<span className="incident-search"><Icon name="search" /><input placeholder={representante ? "Código o asunto…" : jefe ? "Código, asunto, área o responsable…" : "Código, asunto o área…"} value={borrador.busqueda} onChange={e => cambiar("busqueda", e.target.value)} /></span></label>
        <label title={atenciones ? "Filtrar por fecha de asignación" : undefined}><span><Icon name="clock" />Período</span><select aria-label={atenciones ? "Período de asignación" : "Período"} value={borrador.periodo} onChange={e => cambiar("periodo", e.target.value)}><option value="">Cualquier fecha</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option></select></label>
        {(jefe || tecnico) && <label><span><Icon name="reports" />Área</span><select aria-label="Área" value={borrador.area} onChange={e => cambiar("area", e.target.value)}><option value="">Todas las áreas</option>{[...areas].map(([id, nombre]) => <option value={id} key={id}>{nombre}</option>)}</select></label>}
        {jefe && <label><span><Icon name="user" />Responsable</span><select aria-label="Responsable" value={borrador.responsable} onChange={e => cambiar("responsable", e.target.value)}><option value="">Todos los responsables</option>{[...responsables].map(([id, nombre]) => <option value={id} key={id}>{nombre}</option>)}</select></label>}
        {tecnico && <label><span><Icon name="users" />Asignación</span><select aria-label="Asignación" value={borrador.asignacion} onChange={e => cambiar("asignacion", e.target.value)}><option value="">Todas las visibles</option><option value="propia">A mi cargo</option><option value="libre">Sin asignar</option><option value="cierre">Cerradas por mí</option></select></label>}
        <label><span><Icon name="login-ticket" />{representante ? "Prioridad oficial" : "Prioridad"}</span><select value={borrador.prioridad} onChange={e => cambiar("prioridad", e.target.value)}><option value="">{atenciones ? "Todas" : "Todas las prioridades"}</option>{prioridades.map(p => <option key={p}>{p}</option>)}</select></label>
        <label><span><Icon name="clipboard" />Estado</span><select value={borrador.estado} onChange={e => cambiar("estado", e.target.value)}><option value="">Todos los estados</option>{estados.filter(e => !atenciones || e !== "Cerrado").map(e => <option key={e}>{e}</option>)}</select></label>
        <div className="real-actions incident-filter-actions"><button type="button" className="outline" onClick={limpiar}><Icon name="refresh" />Limpiar</button><button type="submit" className="primary"><Icon name="filter" />Aplicar filtros</button></div>
      </div>
    </form>}
    <section className="card table-card" aria-busy={cargando}>
      <div className="section-head"><div><h3>{expandida && <Icon name="clipboard" />}{titulo}{expandida && disponible && <span className="incident-count">{filtradas.length} {filtradas.length === 1 ? "resultado" : "resultados"}</span>}</h3><p>{descripcion || "Últimos 50 registros autorizados"}{actualizado && (" · Actualizado a las " + actualizado)}</p></div>{accion}</div>
      {(!expandida || asignaciones) && <div className="filters real-filters"><label className="search"><Icon name="search" /><input aria-label="Buscar en los registros cargados" placeholder="Buscar código, asunto, área o responsable…" value={borrador.busqueda} onChange={e => cambiar("busqueda", e.target.value)} /></label><select aria-label="Filtrar por estado" value={borrador.estado} onChange={e => cambiar("estado", e.target.value)}><option value="">Todos los estados</option>{estados.map(e => <option key={e}>{e}</option>)}</select>
        {asignaciones && <select aria-label="Filtrar por responsable" value={borrador.responsable} onChange={e => cambiar("responsable", e.target.value)}><option value="">Todos los responsables</option>{[...responsables].map(([id, nombre]) => <option value={id} key={id}>{nombre}</option>)}</select>}
      </div>}
      {!disponible ? <div className="empty" role="status"><Icon name="clipboard" /><h3>{cargando ? "Consultando incidencias…" : "Listado no disponible"}</h3><p>{cargando ? "Obteniendo los registros autorizados para tu perfil." : "Actualiza para reintentar la consulta."}</p></div> : <><div className="table-wrap" tabIndex={0} role="region" aria-label={titulo}>
        <table className="real-ticket-table"><thead><tr>{columnas.map(columna => expandida && (columna === "Código" || columna === "Registro" || columna === "Asignación") ?
          <th scope="col" key={columna} aria-sort={orden.campo === columna ? orden.ascendente ? "ascending" : "descending" : "none"}><button type="button" className="incident-sort" onClick={() => ordenar(columna)}>{columna}<span aria-hidden="true">{orden.campo === columna ? orden.ascendente ? "↑" : "↓" : "↕"}</span></button></th> :
          <th scope="col" key={columna}>{columna}</th>)}</tr></thead><tbody>{visibles.map(ticket => {
            const nombre = nombreResponsable(ticket)
            const iniciales = ticket.responsable_nombre?.trim().split(/\s+/).slice(0, 2).map(parte => parte[0]).join("").toUpperCase()
            const celdas: Record<Columna, ReactNode> = {
              Código: <b className="code">{ticket.codigo}</b>,
              Asunto: <span className="incident-subject" title={ticket.asunto}>{expandida && <Icon name="login-ticket" />}{ticket.asunto}</span>,
              Área: ticket.area_nombre || "Área no disponible",
              Registro: fechaRegistro(ticket.fecha_registro),
              Asignación: ticket.fecha_asignacion ? fechaRegistro(ticket.fecha_asignacion) : "No disponible",
              "Tiempo de atención": ticket.duracion_atencion_minutos == null ? "—" : <span className="incident-duration" title="Tiempo registrado en tus intervenciones del ciclo actual"><Icon name="clock" />{tiempoRegistrado(ticket.duracion_atencion_minutos)}</span>,
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
