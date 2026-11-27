import { useEffect, useRef, useState, type FormEvent } from "react"
import type { IncidenciaReal } from "./api"
import { Badge, Icon } from "./RealUI"
import { consultarCatalogosReporte, consultarReporte, descargarReporte, filtrosVacios,
  type CatalogosReporte, type FiltrosReporte, type GrupoReporte, type ReporteReal } from "./reportes"

const fecha = (valor: string) => new Date(valor).toLocaleString("es-PE", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima",
})
const mensaje = (e: unknown) => e instanceof Error ? e.message : "No se pudo consultar el reporte."

function Desglose({ titulo, grupos, icono }: { titulo: string; grupos: GrupoReporte[]; icono: string }) {
  const maximo = grupos.reduce((max, grupo) => Math.max(max, grupo.total), 1)
  return <section className="card report-breakdown"><h3><Icon name={icono} />{titulo}</h3>{grupos.length ? <ul>{grupos.map(g =>
    <li key={g.id ?? g.nombre}><div><span>{g.nombre || "No disponible"}</span><b>{g.total}</b></div>
      <div className="report-bar" aria-hidden="true"><span style={{ width: `${g.total / maximo * 100}%` }} /></div></li>)}</ul>
    : <p className="help">Sin coincidencias para estos filtros.</p>}</section>
}

export default function RealReports({ token, abrirDetalle }: { token: string; abrirDetalle: (t: IncidenciaReal) => void }) {
  const [borrador, setBorrador] = useState<FiltrosReporte>({ ...filtrosVacios })
  const [aplicados, setAplicados] = useState<FiltrosReporte>({ ...filtrosVacios })
  const [catalogos, setCatalogos] = useState<CatalogosReporte | null>(null)
  const [reporte, setReporte] = useState<ReporteReal | null>(null)
  const [pagina, setPagina] = useState(1)
  const [tamano, setTamano] = useState(25)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [errorCatalogos, setErrorCatalogos] = useState("")
  const [exportando, setExportando] = useState<"pdf" | "xlsx" | null>(null)
  const [errorExportacion, setErrorExportacion] = useState("")
  const [estadoDescarga, setEstadoDescarga] = useState("")
  const [recarga, setRecarga] = useState(0)
  const descarga = useRef<AbortController | null>(null)
  const generacion = useRef(0)
  const pendiente = JSON.stringify(borrador) !== JSON.stringify(aplicados)

  useEffect(() => {
    const controller = new AbortController()
    setCatalogos(null); setErrorCatalogos("")
    consultarCatalogosReporte(token, controller.signal).then(datos => { if (!controller.signal.aborted) setCatalogos(datos) }).catch(e => {
      if (!controller.signal.aborted) setErrorCatalogos(mensaje(e))
    })
    return () => controller.abort()
  }, [token, recarga])

  useEffect(() => {
    const controller = new AbortController()
    setCargando(true); setError(""); setReporte(null); setErrorExportacion(""); setEstadoDescarga("")
    consultarReporte(token, aplicados, pagina, tamano, controller.signal)
      .then(datos => {
        if (controller.signal.aborted) return
        const ultima = Math.max(1, datos.total_paginas)
        if (pagina > ultima) { controller.abort(); setPagina(ultima); return }
        setReporte(datos)
      })
      .catch(e => { if (!controller.signal.aborted) setError(mensaje(e)) })
      .finally(() => { if (!controller.signal.aborted) setCargando(false) })
    return () => controller.abort()
  }, [token, aplicados, pagina, tamano, recarga])

  useEffect(() => () => { generacion.current++; descarga.current?.abort() }, [token])

  function filtrar(evento: FormEvent) {
    evento.preventDefault()
    setPagina(1); setAplicados({ ...borrador })
  }

  function limpiar() {
    setPagina(1); setBorrador({ ...filtrosVacios }); setAplicados({ ...filtrosVacios })
  }

  async function exportar(formato: "pdf" | "xlsx") {
    if (exportando || cargando || pendiente || !reporte?.exportacion.formatos.includes(formato)) return
    const controller = new AbortController()
    descarga.current = controller
    const vigente = generacion.current
    setExportando(formato); setErrorExportacion(""); setEstadoDescarga("")
    try {
      const archivo = await descargarReporte(token, aplicados, formato, controller.signal)
      if (controller.signal.aborted || vigente !== generacion.current) return
      const url = URL.createObjectURL(archivo)
      const enlace = document.createElement("a")
      enlace.href = url; enlace.download = `grocio-prado-incidencias.${formato}`
      document.body.appendChild(enlace); enlace.click(); enlace.remove()
      // Dar tiempo al navegador para iniciar la descarga antes de liberar el buffer.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setEstadoDescarga(`Archivo ${formato.toUpperCase()} generado. La descarga abarca todas las coincidencias y tiene su propia fecha de generación.`)
    } catch (e) { if (!controller.signal.aborted && vigente === generacion.current) setErrorExportacion(mensaje(e)) }
    finally { if (vigente === generacion.current) { setExportando(null); descarga.current = null } }
  }

  const excesivo = !!reporte && reporte.resumen.total > reporte.exportacion.maximo_filas
  const bloquear = cargando || !reporte || pendiente || !!exportando || excesivo
  const tarjetas = [
    { numero: reporte?.resumen.total, nombre: "Total de incidencias", icono: "clipboard", color: "blue" },
    { numero: reporte?.resumen.pendientes, nombre: "Pendientes", icono: "clock", color: "amber" },
    { numero: reporte?.resumen.en_revision, nombre: "En revisión", icono: "tool", color: "violet" },
    { numero: reporte?.resumen.cerradas, nombre: "Cerradas", icono: "check", color: "green" },
  ]
  const campo = (clave: keyof FiltrosReporte, valor: string) => setBorrador(f => ({ ...f, [clave]: valor }))
  const primero = reporte?.incidencias.length ? (reporte.pagina - 1) * reporte.tamano_pagina + 1 : 0
  const ultimo = primero && reporte ? primero + reporte.incidencias.length - 1 : 0

  return <div className="real-reports">
    <div className="page-title-row institutional-hero"><div className="institutional-heading"><Icon name="reports" /><div><h2>Reportes institucionales</h2><p>Consulta consolidada de incidencias municipales.</p></div></div></div>
    <section className="card report-filter-card"><div className="section-head"><div className="institutional-heading"><Icon name="filter" /><div><h3>Filtros del reporte</h3><p>Las fechas corresponden a la hora de Lima. Los filtros se aplican a todo el reporte.</p></div></div>
      <div className="real-actions"><button className="outline" disabled={cargando || !!exportando} onClick={() => setRecarga(n => n + 1)}><Icon name="refresh" />Actualizar</button>
        <button className="outline" disabled={bloquear || !reporte?.exportacion.formatos.includes("pdf")} onClick={() => void exportar("pdf")}><Icon name="download" />{exportando === "pdf" ? "Generando PDF…" : "Exportar PDF"}</button>
        <button className="primary" disabled={bloquear || !reporte?.exportacion.formatos.includes("xlsx")} onClick={() => void exportar("xlsx")}><Icon name="download" />{exportando === "xlsx" ? "Generando Excel…" : "Exportar Excel"}</button></div></div>
      <form onSubmit={filtrar}><fieldset disabled={cargando || !!exportando} className="report-filters">
        <legend className="visually-hidden">Seleccionar filtros institucionales</legend>
        <label>Desde<input type="date" value={borrador.desde} max={borrador.hasta || undefined} onChange={e => campo("desde", e.target.value)} /></label>
        <label>Hasta<input type="date" value={borrador.hasta} min={borrador.desde || undefined} onChange={e => campo("hasta", e.target.value)} /></label>
        <label>Área municipal<select disabled={!catalogos} value={borrador.area_id} onChange={e => campo("area_id", e.target.value)}><option value="">Todas las áreas</option>{catalogos?.areas.map(a => <option key={a.id} value={a.id}>{a.nombre}{!a.activo ? " (inactiva)" : ""}</option>)}</select></label>
        <label>Estado<select value={borrador.estado} onChange={e => campo("estado", e.target.value)}><option value="">Todos los estados</option>{["Pendiente", "En revisión", "Cerrado"].map(e => <option key={e}>{e}</option>)}</select></label>
        <label>Prioridad oficial<select value={borrador.prioridad} onChange={e => campo("prioridad", e.target.value)}><option value="">Todas las prioridades</option>{["Alta", "Media", "Baja"].map(p => <option key={p}>{p}</option>)}<option value="sin_evaluar">Pendiente de evaluación</option><option value="no_clasificada">No clasificada</option></select></label>
        <label>Responsable actual o de cierre<select disabled={!catalogos} value={borrador.responsable_id} onChange={e => campo("responsable_id", e.target.value)}><option value="">Todos los responsables</option><option value="sin_responsable">Sin responsable</option>{catalogos?.responsables.map(p => <option key={p.id} value={p.id}>{p.nombre} · {p.rol}{!p.habilitado ? " (deshabilitado)" : ""}</option>)}</select></label>
      </fieldset><div className="report-filter-actions"><p className="help">{pendiente ? "Hay filtros pendientes de aplicar." : "Las estadísticas incluyen todas las coincidencias, no solo la página visible."}</p>
        <div className="real-actions"><button className="outline" type="button" disabled={cargando || !!exportando} onClick={limpiar}>Limpiar</button><button className="primary" type="submit" disabled={cargando || !!exportando}>Aplicar filtros</button></div></div></form>
      {errorCatalogos && <p className="auth-error" role="alert">Catálogos no disponibles: {errorCatalogos} Pulsa Actualizar para reintentar.</p>}
    </section>
    {error && <div className="auth-error" role="alert">{error}</div>}
    {errorExportacion && <div className="auth-error" role="alert">{errorExportacion}</div>}
    {estadoDescarga && <p className="notice" role="status">{estadoDescarga}</p>}
    {excesivo && <p className="notice">La consulta tiene {reporte.resumen.total} coincidencias. Para exportar, reduce el período o filtra hasta {reporte.exportacion.maximo_filas} incidencias. La tabla y los totales siguen incluyendo todo el conjunto.</p>}
    {reporte && reporte.exportacion.formatos.length < 2 && <p className="notice">Algún formato no está disponible en el servidor. Las descargas solo se habilitan cuando sus dependencias están disponibles.</p>}

    <div className="kpis four" aria-busy={cargando}>{tarjetas.map(t => <article className="kpi" key={t.nombre}><span className={`kpi-icon ${t.color}`}><Icon name={t.icono} /></span><div><b>{t.numero ?? "—"}</b><p>{t.nombre}</p></div></article>)}</div>
    {reporte && <><p className="report-scope">{reporte.organizacion} · Generado: {fecha(reporte.fecha_generacion)} (Lima). Estados vigentes de las incidencias registradas en el período.</p>
      <div className="report-applied" aria-label="Filtros aplicados">{Object.entries(reporte.filtros_aplicados).map(([k, v]) => <span key={k}><b>{k}:</b> {v}</span>)}</div>
      <div className="report-breakdowns"><Desglose titulo="Por área municipal" grupos={reporte.desgloses.areas} icono="reports" /><Desglose titulo="Por prioridad oficial" grupos={reporte.desgloses.prioridades} icono="clipboard" /><Desglose titulo="Por responsable" grupos={reporte.desgloses.responsables} icono="user" /></div></>}
    <section className="card table-card" aria-busy={cargando}><div className="section-head"><div><h3>Incidencias del reporte</h3><p>{reporte ? `${reporte.resumen.total} coincidencias en PostgreSQL · Orden por fecha de registro` : cargando ? "Consultando datos autorizados…" : "Consulta no disponible"}</p></div></div>
      <div className="table-wrap" role="region" tabIndex={0} aria-label="Incidencias del reporte institucional"><table className="real-ticket-table"><thead><tr>{["Código", "Asunto", "Área", "Registro", "Prioridad", "Estado", "Responsable", "Acciones"].map(c => <th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{reporte?.incidencias.map(t => <tr key={t.id}>
        <td><b className="code">{t.codigo}</b></td><td title={t.asunto}>{t.asunto}</td><td>{t.area_nombre || "Área no disponible"}</td><td>{fecha(t.fecha_registro)}</td><td><Badge>{t.prioridad || "Pendiente de evaluación"}</Badge>{!t.prioridad && t.prioridad_revision_pendiente && <small className="cell-caption">Provisional: {t.prioridad_provisional} · revisión JEFE</small>}</td><td><Badge>{t.estado}</Badge></td><td>{t.responsable_nombre || "Sin responsable"}{t.responsable_tipo === "cierre" && <small className="cell-caption">Cerrado por</small>}</td><td><button className="row-action" aria-label={`Ver detalle de ${t.codigo}`} onClick={() => abrirDetalle(t)}>Ver<Icon name="arrow" /></button></td>
      </tr>)}</tbody></table></div>
      {(!reporte || !reporte.incidencias.length) && <div className="empty" role="status"><Icon name="reports" /><h3>{cargando ? "Preparando reporte…" : error ? "Reporte no disponible" : reporte?.resumen.total ? "Página sin registros" : "Sin incidencias para estos filtros"}</h3><p>{error ? "Actualiza para reintentar. Los errores no representan un total de cero." : "Conservamos las cabeceras y los totales reales, incluidos los ceros."}</p></div>}
      <div className="pagination report-pagination"><span>{reporte ? `${primero}–${ultimo} de ${reporte.resumen.total} coincidencias` : "Sin resultados disponibles"}</span>
        <div className="real-actions"><label>Por página<select aria-label="Registros por página" value={tamano} disabled={cargando || !!exportando} onChange={e => { setTamano(Number(e.target.value)); setPagina(1) }}>{[25, 50, 100].map(n => <option key={n}>{n}</option>)}</select></label>
          <button className="outline" disabled={cargando || !!exportando || !reporte || pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</button><span>Página {pagina} de {Math.max(1, reporte?.total_paginas || 0)}</span><button className="outline" disabled={cargando || !!exportando || !reporte || pagina >= reporte.total_paginas} onClick={() => setPagina(p => p + 1)}>Siguiente</button></div></div>
    </section>
  </div>
}
