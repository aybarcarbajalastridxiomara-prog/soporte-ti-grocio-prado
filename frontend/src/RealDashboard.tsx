import { useState, type CSSProperties } from "react"
import type { IncidenciaReal, PerfilReal, ResumenReal } from "./api"
import type { VistaReal } from "./RealApp"
import { Icon } from "./RealUI"
import RealTicketList, { BannerIncidencias } from "./RealTicketList"

type Props = {
  vista: VistaReal; perfil: PerfilReal; incidencias: IncidenciaReal[]; resumen: ResumenReal | null
  cargando: boolean; actualizado: string; actualizar: () => void
  navegar: (vista: VistaReal) => void; abrirDetalle: (ticket: IncidenciaReal) => void
}

const filtrosIniciales = { periodo: "", estado: "", prioridad: "", area: "", responsable: "" }
const estados = [
  { nombre: "Pendiente", clave: "pendientes", etiqueta: "Pendientes", color: "#eaa11b" },
  { nombre: "En revisión", clave: "en_revision", etiqueta: "En revisión", color: "#7557ef" },
  { nombre: "Cerrado", clave: "cerradas", etiqueta: "Cerradas", color: "#13935b" },
] as const
const fechaLima = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" })
const diaSemana = new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", weekday: "short" })
const textosRol: Record<PerfilReal["rol"], string> = {
  JEFE: "Supervisa las incidencias y la distribución de la atención del equipo.",
  ASISTENTE: "Revisa tus asignaciones activas y el estado de sus prioridades.",
  PRACTICANTE: "Revisa tus asignaciones activas y las incidencias que cerraste.",
  REPRESENTANTE: "Consulta el estado de las solicitudes de soporte de tu área.",
}

function diasRecientes(cantidad: number) {
  const hoy = new Date(`${fechaLima.format(new Date())}T00:00:00Z`)
  return Array.from({ length: cantidad }, (_, i) => {
    const dia = new Date(hoy)
    dia.setUTCDate(hoy.getUTCDate() - (cantidad - 1 - i))
    return { fecha: dia.toISOString().slice(0, 10), etiqueta: diaSemana.format(dia) }
  })
}

function contar(tickets: IncidenciaReal[], obtenerGrupo: (ticket: IncidenciaReal) => string) {
  const grupos = new Map<string, number>()
  for (const ticket of tickets) {
    const grupo = obtenerGrupo(ticket)
    grupos.set(grupo, (grupos.get(grupo) ?? 0) + 1)
  }
  return grupos
}

const porcentaje = (valor: number, total: number) => total ? Math.round(valor * 100 / total) : 0
const registroDia = (ticket: IncidenciaReal) => fechaLima.format(new Date(ticket.fecha_registro))
const prioridadDe = (ticket: IncidenciaReal) => ticket.prioridad || ticket.prioridad_provisional || "Sin definir"

function BarrasAnalisis({ titulo, icono, grupos, total }: { titulo: string; icono: string; grupos: [string, number][]; total: number }) {
  return <section className="card real-dashboard-chart">
    <h3><Icon name={icono} /> {titulo}</h3>
    {total ? <ul className="real-dashboard-bars">{grupos.map(([nombre, cantidad], indice) => (
      <li key={`${nombre}-${indice}`}><span title={nombre}>{nombre}</span><div><i style={{ width: `${porcentaje(cantidad, total)}%` }} /></div><b>{cantidad}</b></li>
    ))}</ul> : <p className="real-dashboard-empty">Sin registros en la selección.</p>}
  </section>
}

function TendenciaAnalisis({ titulo, tendencia, disponible }: { titulo: string; tendencia: { fecha: string; etiqueta: string; total: number }[]; disponible: boolean }) {
  const maximo = Math.max(1, ...tendencia.map(d => d.total))
  const puntos = tendencia.map((d, i) => ({ x: `${i / 6 * 100}%`, y: `${94 - d.total / maximo * 81}%` }))
  return <section className="card real-dashboard-chart">
    <h3><Icon name="dashboard-trend" /> {titulo}</h3>
    <p className="real-chart-caption">Últimos 7 días · fecha de registro</p>
    {disponible ? <div className="real-dashboard-trend">
      <div className="real-dashboard-plot" aria-hidden="true">
        <span style={{ clipPath: `polygon(0% 100%, ${puntos.map(p => `${p.x} ${p.y}`).join(", ")}, 100% 100%)` }} />
        {tendencia.map((dia, i) => <i key={dia.fecha} style={{ "--punto-x": puntos[i].x, "--punto-y": puntos[i].y } as CSSProperties}><b>{dia.total}</b></i>)}
      </div>
      <ul>{tendencia.map(dia => <li key={dia.fecha} aria-label={`${dia.fecha}: ${dia.total} incidencias`}>{dia.etiqueta}</li>)}</ul>
    </div> : <p className="real-dashboard-empty">Tendencia no disponible.</p>}
  </section>
}

export default function RealDashboard({ vista, perfil, incidencias, resumen, cargando, actualizado, actualizar, navegar, abrirDetalle }: Props) {
  const representante = perfil.rol === "REPRESENTANTE"
  const jefe = perfil.rol === "JEFE"
  const asistente = perfil.rol === "ASISTENTE"
  const practicante = perfil.rol === "PRACTICANTE"
  const tecnico = asistente || practicante
  const [borrador, setBorrador] = useState(filtrosIniciales)
  const [filtros, setFiltros] = useState(filtrosIniciales)
  const acciones = <div className="real-actions">
    <button className="outline" onClick={actualizar} disabled={cargando}><Icon name="refresh" />{cargando ? "Actualizando…" : "Actualizar"}</button>
    {representante && <button className="primary" onClick={() => navegar("registro")}><Icon name="plus" />Registrar incidencia</button>}
  </div>

  if (vista !== "dashboard") return <div className="incident-directory">
    <BannerIncidencias titulo={representante ? "Incidencias de mi área" : "Listado de incidencias"}
      descripcion={representante ? "Consulta y da seguimiento a las solicitudes registradas en tu área." : "Consulta, filtra y da seguimiento a las incidencias registradas."} />
    <RealTicketList vistaCompleta={{ modo: "incidencias", rol: perfil.rol, usuarioId: perfil.id }} incidencias={incidencias} cargando={cargando} disponible={Boolean(actualizado)} actualizado={actualizado} titulo="Incidencias registradas" accion={acciones} abrirDetalle={abrirDetalle} />
  </div>

  const basePanel = tecnico ? incidencias.filter(t => t.responsable_id === perfil.id &&
    (t.responsable_tipo === "activo" || (practicante && t.responsable_tipo === "cierre"))) : incidencias
  const filtrando = Object.values(filtros).some(Boolean)
  const desde = filtros.periodo ? diasRecientes(Number(filtros.periodo))[0].fecha : ""
  const seleccionadas = basePanel.filter(t => (!desde || registroDia(t) >= desde) &&
    (!filtros.estado || t.estado === filtros.estado) &&
    (!filtros.prioridad || prioridadDe(t) === filtros.prioridad) &&
    (!filtros.area || t.area_id === filtros.area) &&
    (!filtros.responsable || (t.responsable_id ?? (t.responsable_tipo === "sin_asignar" ? "sin-asignar" : "")) === filtros.responsable))
  const porEstado = contar(seleccionadas, t => t.estado)
  const indicadores = (filtrando || tecnico) && actualizado ? {
    total: seleccionadas.length,
    pendientes: porEstado.get("Pendiente") ?? 0,
    en_revision: porEstado.get("En revisión") ?? 0,
    cerradas: porEstado.get("Cerrado") ?? 0,
  } : filtrando || tecnico ? null : resumen
  const total = indicadores?.total ?? 0
  const propiasActivas = seleccionadas.filter(t => t.responsable_tipo === "activo")
  const propuestas = seleccionadas.filter(t => !t.prioridad && t.prioridad_revision_pendiente).length
  const indefinidas = seleccionadas.filter(t => prioridadDe(t) === "Sin definir").length
  const altas = seleccionadas.filter(t => prioridadDe(t) === "Alta").length
  const tarjetas = asistente ? [
    { numero: indicadores?.total, etiqueta: "Mis asignaciones activas", color: "blue", icono: "login-ticket" },
    { numero: indicadores && altas, etiqueta: "Prioridad alta", color: "amber", icono: "dashboard-trend" },
    { numero: indicadores && propuestas, etiqueta: "Propuestas por revisar", color: "violet", icono: "clock" },
    { numero: indicadores && indefinidas, etiqueta: "Sin prioridad definida", color: "green", icono: "login-bars" },
  ] : practicante ? [
    { numero: indicadores?.total, etiqueta: "Mis incidencias", color: "blue", icono: "login-ticket" },
    { numero: indicadores && propiasActivas.length, etiqueta: "Asignaciones activas", color: "amber", icono: "clock" },
    { numero: indicadores?.en_revision, etiqueta: "En revisión", color: "violet", icono: "tool" },
    { numero: indicadores?.cerradas, etiqueta: "Cerradas por mí", color: "green", icono: "check" },
  ] : [
    { numero: indicadores?.total, etiqueta: representante ? "Solicitudes de mi área" : "Total de incidencias", color: "blue", icono: "login-ticket" },
    { numero: indicadores?.pendientes, etiqueta: "Pendientes", color: "amber", icono: "clock" },
    { numero: indicadores?.en_revision, etiqueta: "En revisión", color: "violet", icono: "tool" },
    { numero: indicadores?.cerradas, etiqueta: "Cerradas", color: "green", icono: "check" },
  ]
  const partes = estados.map(e => ({ ...e, cantidad: indicadores?.[e.clave] ?? 0 }))
  let acumulado = 0
  const arcos = partes.map(({ cantidad, color }) => {
    const inicio = acumulado
    acumulado += total ? cantidad * 100 / total : 0
    return `${color} ${inicio}% ${acumulado}%`
  })
  const areas = new Map(incidencias.flatMap(t => t.area_nombre ? [[t.area_id, t.area_nombre] as const] : []))
  const responsables = new Map(incidencias.flatMap(t => t.responsable_id && t.responsable_nombre ? [[t.responsable_id, t.responsable_nombre] as const] : []))
  if (incidencias.some(t => t.responsable_tipo === "sin_asignar")) responsables.set("sin-asignar", "Sin asignar")
  const porResponsable = [...contar(seleccionadas, t => t.responsable_id || (t.responsable_tipo === "sin_asignar" ? "sin-asignar" : ""))]
    .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, cantidad]): [string, number] => [responsables.get(id) ?? "No disponible", cantidad])
  const porArea = jefe || asistente ? [...contar(seleccionadas, t => t.area_id)]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, cantidad]): [string, number] => [areas.get(id) ?? "Área no disponible", cantidad]) : []
  const porPrioridad = [...contar(seleccionadas, prioridadDe)].sort((a, b) => b[1] - a[1])
  const prioridadesActivas = [...contar(propiasActivas, prioridadDe)].sort((a, b) => b[1] - a[1])
  const ultimos30 = diasRecientes(30)
  const inicio30 = ultimos30[0].fecha
  const inicio7 = ultimos30[ultimos30.length - 7].fecha
  const antiguedad = (tickets: IncidenciaReal[]) => {
    const grupos = contar(tickets, t => {
      const dia = registroDia(t)
      return dia >= inicio7 ? "Hasta 7 días" : dia >= inicio30 ? "De 8 a 30 días" : "Más de 30 días"
    })
    return ["Hasta 7 días", "De 8 a 30 días", "Más de 30 días"].map((nombre): [string, number] => [nombre, grupos.get(nombre) ?? 0])
  }
  const abiertas = seleccionadas.filter(t => t.estado !== "Cerrado")
  const pendientes = seleccionadas.filter(t => t.estado === "Pendiente")
  const asignacionAbiertas = contar(abiertas, t => t.responsable_tipo ?? "")
  const cerradasPorPrioridad = [...contar(seleccionadas.filter(t => t.estado === "Cerrado"), prioridadDe)]
    .sort((a, b) => b[1] - a[1])
  const porDia = contar(seleccionadas, registroDia)
  const tendencia = ultimos30.slice(-7).map(d => ({ ...d, total: porDia.get(d.fecha) ?? 0 }))
  const tasa = porcentaje(indicadores?.cerradas ?? 0, total)
  const campo = (nombre: keyof typeof filtrosIniciales, valor: string) => setBorrador(actual => ({ ...actual, [nombre]: valor }))

  return <div className="real-main-dashboard">
    <section className="real-shell-greeting">
      <div><h2>¡Hola, {perfil.nombre_completo}!</h2><p>{textosRol[perfil.rol]}</p></div>
      <div className="real-dashboard-banner-art" aria-hidden="true"><span className="real-access-laptop"><Icon name="login-headset" /></span></div>
    </section>
    <div className="kpis four" aria-label="Indicadores generales">
      {tarjetas.map(t => <article className="kpi" key={t.etiqueta}><span className={`kpi-icon ${t.color}`}><Icon name={t.icono} /></span><div><b>{t.numero ?? "—"}</b><p>{t.etiqueta}</p></div></article>)}
    </div>
    <form className="card real-analysis-filters" onSubmit={e => { e.preventDefault(); setFiltros(borrador) }}>
      <h3><Icon name="dashboard-filter" /> Filtros de análisis</h3>
      <label>Periodo<select value={borrador.periodo} onChange={e => campo("periodo", e.target.value)}><option value="">Todo el periodo</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option></select></label>
      {jefe && <><label>Responsable<select value={borrador.responsable} onChange={e => campo("responsable", e.target.value)}><option value="">Todos</option>{[...responsables].map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></label><label>Área<select value={borrador.area} onChange={e => campo("area", e.target.value)}><option value="">Todas</option>{[...areas].map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select></label></>}
      {!representante && <label>Prioridad<select value={borrador.prioridad} onChange={e => campo("prioridad", e.target.value)}><option value="">Todas</option>{["Alta", "Media", "Baja"].map(p => <option key={p}>{p}</option>)}</select></label>}
      <label>Estado<select value={borrador.estado} onChange={e => campo("estado", e.target.value)}><option value="">Todos</option>{estados.filter(e => !asistente || e.nombre !== "Cerrado").map(e => <option key={e.clave}>{e.nombre}</option>)}</select></label>
      <div className="real-analysis-actions"><button className="outline" type="button" onClick={() => { setBorrador(filtrosIniciales); setFiltros(filtrosIniciales) }}>Limpiar</button><button className="primary" type="submit">Aplicar</button></div>
    </form>
    <p className="real-analysis-scope">{tecnico ? "Indicadores y filtros sobre tus incidencias entre los últimos 50 registros autorizados cargados." : filtrando ? `${seleccionadas.length} coincidencias en ${incidencias.length} registros cargados.` : "Indicadores del total autorizado. Desgloses y filtros sobre los últimos 50 registros cargados."}</p>
    {jefe && <div className="real-dashboard-charts">
      <section className="card real-dashboard-chart">
        <h3><Icon name="login-bars" /> Incidencias por estado</h3>
        <div className="real-state-layout">
          <div className="real-dashboard-ring" style={{ background: total ? `conic-gradient(${arcos.join(", ")})` : undefined }} aria-hidden="true"><span><b>{indicadores?.total ?? "—"}</b>Incidencias</span></div>
          <ul>{partes.map(e => <li key={e.clave}><i style={{ background: e.color }} /><span>{e.etiqueta}</span><b>{indicadores ? e.cantidad : "—"}</b></li>)}</ul>
        </div>
      </section>
      <BarrasAnalisis titulo="Incidencias por responsable" icono="users" grupos={porResponsable} total={seleccionadas.length} />
      <TendenciaAnalisis titulo="Tendencia de incidencias" tendencia={tendencia} disponible={Boolean(actualizado)} />
    </div>}
    {jefe && <div className="real-dashboard-charts real-dashboard-charts-pair">
      <BarrasAnalisis titulo="Asignación de casos abiertos" icono="users" total={abiertas.length}
        grupos={[["Con responsable activo", asignacionAbiertas.get("activo") ?? 0], ["Sin asignar", asignacionAbiertas.get("sin_asignar") ?? 0], ["Información no disponible", asignacionAbiertas.get("") ?? 0]]} />
      <BarrasAnalisis titulo="Antigüedad de casos abiertos" icono="clock" total={abiertas.length} grupos={antiguedad(abiertas)} />
    </div>}
    {asistente && <div className="real-dashboard-charts real-dashboard-charts-pair">
      <BarrasAnalisis titulo="Mis asignaciones por prioridad" icono="login-bars" grupos={porPrioridad} total={seleccionadas.length} />
      <BarrasAnalisis titulo="Revisión de prioridades" icono="clock" total={seleccionadas.length}
        grupos={[["Con prioridad oficial", seleccionadas.filter(t => Boolean(t.prioridad)).length], ["Propuestas por revisar", propuestas], ["Sin prioridad definida", indefinidas]]} />
      <BarrasAnalisis titulo="Mis asignaciones por área" icono="login-bars" grupos={porArea} total={seleccionadas.length} />
      <TendenciaAnalisis titulo="Registro de mis casos activos" tendencia={tendencia} disponible={Boolean(actualizado)} />
    </div>}
    {practicante && <div className="real-dashboard-charts real-dashboard-charts-pair">
      <BarrasAnalisis titulo="Avance de mis atenciones" icono="tool" total={seleccionadas.length}
        grupos={[["Asignaciones activas", propiasActivas.length], ["Cerradas por mí", indicadores?.cerradas ?? 0]]} />
      <BarrasAnalisis titulo="Antigüedad de mis asignaciones" icono="clock" grupos={antiguedad(propiasActivas)} total={propiasActivas.length} />
      <BarrasAnalisis titulo="Prioridad de mis asignaciones activas" icono="login-bars" grupos={prioridadesActivas} total={propiasActivas.length} />
      <BarrasAnalisis titulo="Mis cierres por prioridad" icono="check" grupos={cerradasPorPrioridad} total={indicadores?.cerradas ?? 0} />
    </div>}
    {representante && <div className="real-dashboard-charts real-dashboard-charts-pair">
      <BarrasAnalisis titulo="Estado de las solicitudes de mi área" icono="login-bars" total={total} grupos={partes.map(e => [e.etiqueta, e.cantidad])} />
      <section className="card real-dashboard-chart real-dashboard-area-progress">
        <h3><Icon name="check" /> Avance de las solicitudes de mi área</h3>
        {total ? <><progress max={total} value={indicadores?.cerradas ?? 0} aria-label="Proporción de solicitudes cerradas" /><p>{indicadores?.cerradas} cerradas de {total} solicitudes</p></> : <p className="real-dashboard-empty">Sin solicitudes en la selección.</p>}
      </section>
      <TendenciaAnalisis titulo="Solicitudes registradas en mi área" tendencia={tendencia} disponible={Boolean(actualizado)} />
      <BarrasAnalisis titulo="Antigüedad de solicitudes pendientes de mi área" icono="clock" grupos={antiguedad(pendientes)} total={pendientes.length} />
    </div>}
    <div className="real-dashboard-bottom">
      <RealTicketList incidencias={seleccionadas} cargando={cargando} disponible={Boolean(actualizado)} actualizado={actualizado}
        titulo={asistente ? "Mis asignaciones recientes" : practicante ? "Mis incidencias recientes" : representante ? "Solicitudes recientes de mi área" : "Incidencias recientes"}
        descripcion="Vista rápida de los tres registros más recientes" limiteVisible={3} abrirDetalle={abrirDetalle}
        accion={<button className="text-button" onClick={() => navegar(tecnico ? "atencion" : "incidencias")}>{tecnico ? "Mis atenciones" : "Ver todas"}<Icon name="arrow" /></button>} />
      <div className="real-dashboard-side">
      {jefe && <BarrasAnalisis titulo="Áreas con más incidencias" icono="login-bars" grupos={porArea} total={seleccionadas.length} />}
      {jefe && <BarrasAnalisis titulo="Incidencias por prioridad" icono="dashboard-trend" grupos={porPrioridad} total={seleccionadas.length} />}
      <section className="card real-dashboard-chart real-dashboard-followup">
        <h3><Icon name={jefe ? "login-shield" : "refresh"} /> {jefe ? "Seguimiento de cierres" : representante ? "Gestionar mis solicitudes" : "Gestionar mis atenciones"}</h3>
        {jefe && <><div className="real-dashboard-ring" style={{ background: total ? `conic-gradient(#13935b 0% ${tasa}%, #e6eef8 ${tasa}% 100%)` : undefined }}><span><b>{indicadores && total ? `${tasa}%` : "—"}</b>Cerradas</span></div>
        {indicadores && total > 0 && <p>{indicadores.cerradas} de {total} incidencias</p>}</>}
        {acciones}
      </section>
      </div>
    </div>
  </div>
}
