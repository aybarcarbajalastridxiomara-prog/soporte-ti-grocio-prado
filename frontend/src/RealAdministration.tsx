import { useEffect, useState, type FormEvent } from "react"
import { solicitarAPI, type PerfilReal, type Rol } from "./api"
import { Badge, Icon } from "./RealUI"

type Area = { id: string; nombre: string; activo: boolean }
type Configuracion = { permisos_verificados?: boolean; edicion_habilitada: boolean; invitaciones_habilitadas: boolean; motivos: string[] }
const roles: Rol[] = ["JEFE", "ASISTENTE", "PRACTICANTE", "REPRESENTANTE"]
const mensajeError = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación."

export default function RealAdministration({ token, perfil }: { token: string; perfil: PerfilReal }) {
  const [usuarios, setUsuarios] = useState<PerfilReal[]>([])
  const [areas, setAreas] = useState<Area[]>([])
  const [configuracion, setConfiguracion] = useState<Configuracion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [recarga, setRecarga] = useState(0)
  const [busqueda, setBusqueda] = useState("")
  const [vista, setVista] = useState<"usuarios" | "areas" | "historial">("usuarios")
  const [filtroRol, setFiltroRol] = useState("")
  const [filtroArea, setFiltroArea] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("")
  const [pagina, setPagina] = useState(1)
  const [porPagina, setPorPagina] = useState(10)
  const [edicion, setEdicion] = useState<PerfilReal | "invitar" | null>(null)
  const [nombre, setNombre] = useState("")
  const [usuario, setUsuario] = useState("")
  const [correo, setCorreo] = useState("")
  const [rol, setRol] = useState<Rol>("REPRESENTANTE")
  const [area, setArea] = useState("")
  const [habilitado, setHabilitado] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [auditoria,setAuditoria] = useState<{id:string;accion:string;actor_id:string;usuario_id:string;fecha_registro:string}[]|null>(null)
  const [errorAuditoria,setErrorAuditoria] = useState("")
  const [cargandoAuditoria, setCargandoAuditoria] = useState(false)

  useEffect(() => {
    let vigente = true
    setCargando(true); setError(""); setConfiguracion(null)
    Promise.all([
      solicitarAPI<PerfilReal[]>("/api/usuarios", token),
      solicitarAPI<Area[]>("/api/areas", token),
      solicitarAPI<Configuracion>("/api/administracion/configuracion", token),
    ]).then(([personas, dependencias, config]) => {
      if (!vigente) return
      setUsuarios(personas); setAreas(dependencias); setConfiguracion({ ...config, edicion_habilitada: config.edicion_habilitada && config.permisos_verificados === true, invitaciones_habilitadas: config.invitaciones_habilitadas && config.permisos_verificados === true })
    }).catch((fallo: unknown) => { if (vigente) setError(mensajeError(fallo)) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [token, recarga])

  function abrir(persona: PerfilReal | "invitar") {
    setEdicion(persona); setError(""); setMensaje(""); setCorreo("")
    setNombre(persona === "invitar" ? "" : persona.nombre_completo)
    setUsuario(persona === "invitar" ? "" : persona.usuario)
    setRol(persona === "invitar" ? "REPRESENTANTE" : persona.rol)
    setArea(persona === "invitar" ? "" : persona.area_id)
    setHabilitado(persona === "invitar" ? true : persona.habilitado)
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando || !edicion || !configuracion) return
    const invitando = edicion === "invitar"
    if (invitando ? !configuracion.invitaciones_habilitadas : !configuracion.edicion_habilitada) return
    setGuardando(true); setError(""); setMensaje("")
    try {
      const datos = { nombre_completo: nombre.trim(), usuario: usuario.trim(), rol, area_id: area }
      await solicitarAPI<PerfilReal>(invitando ? "/api/usuarios/invitar" : `/api/usuarios/${encodeURIComponent(edicion.id)}`, token, {
        method: invitando ? "POST" : "PATCH",
        body: JSON.stringify(invitando ? { ...datos, correo: correo.trim() } : { ...datos, habilitado }),
      })
      setMensaje(invitando ? "Supabase aceptó la invitación y el perfil fue registrado. La entrega del correo y la activación deben confirmarse con el destinatario." : "Perfil actualizado correctamente.")
      setEdicion(null); setRecarga((x) => x + 1)
    } catch (fallo) { setError(mensajeError(fallo)) }
    finally { setGuardando(false) }
  }

  const propiasCredenciales = edicion !== null && edicion !== "invitar" && edicion.id === perfil.id
  const nombresArea = new Map(areas.map(a => [a.id, a.nombre]))
  const consulta = busqueda.trim().toLocaleLowerCase("es")
  const visibles = usuarios.filter(persona =>
    (!filtroRol || persona.rol === filtroRol) &&
    (!filtroArea || persona.area_id === filtroArea) &&
    (!filtroEstado || persona.habilitado === (filtroEstado === "habilitado")) &&
    `${persona.nombre_completo} ${persona.usuario} ${persona.rol} ${nombresArea.get(persona.area_id) || ""}`
      .toLocaleLowerCase("es").includes(consulta)
  )
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / porPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const desde = (paginaActual - 1) * porPagina
  const registros = visibles.slice(desde, desde + porPagina)

  async function consultarHistorial() {
    setVista("historial")
    setErrorAuditoria(""); setAuditoria(null); setCargandoAuditoria(true)
    try { setAuditoria(await solicitarAPI<typeof auditoria>("/api/administracion/historial", token)) }
    catch (fallo) { setErrorAuditoria(mensajeError(fallo)) }
    finally { setCargandoAuditoria(false) }
  }

  return <div className="real-admin">
    <div className="page-title-row"><div className="admin-heading"><span className="admin-symbol"><Icon name="users" /></span><div><h2>Gestión de usuarios y áreas</h2><p>Administración de cuentas, roles y áreas municipales.</p></div></div><div className="real-actions"><button className="outline" onClick={() => { setRecarga(x => x + 1); if (vista === "historial") void consultarHistorial() }} disabled={cargando || cargandoAuditoria}><Icon name="refresh" />Actualizar</button><button className="primary" onClick={() => abrir("invitar")} disabled={cargando || !configuracion?.invitaciones_habilitadas}><Icon name="plus" />Nuevo usuario</button></div></div>
    {mensaje && <div className="notice" role="status">{mensaje}</div>}
    {!edicion && error && <div className="auth-error" role="alert">{error}</div>}
    {configuracion && configuracion.motivos.length > 0 && <details className="notice observation-notice admin-warning"><summary>Configuración administrativa pendiente</summary>{configuracion.motivos.map(motivo => <p key={motivo}>{motivo}</p>)}</details>}
    <div className="admin-summary">
      <div className="admin-card"><span className="admin-symbol"><Icon name="users" /></span><div><h3>Usuarios registrados</h3><strong>{cargando || error ? "—" : usuarios.length}</strong><button type="button" className="text-button" onClick={() => setVista("usuarios")}>Administrar cuentas <Icon name="arrow" /></button></div></div>
      <div className="admin-card"><span className="admin-symbol"><Icon name="reports" /></span><div><h3>Áreas municipales</h3><strong>{cargando || error ? "—" : areas.length}</strong><button type="button" className="text-button" onClick={() => setVista("areas")}>Consultar áreas <Icon name="arrow" /></button></div></div>
      <div className="admin-card"><span className="admin-symbol"><Icon name="clock" /></span><div><h3>Historial administrativo</h3><p>Cambios en los perfiles</p><button type="button" className="text-button" disabled={cargandoAuditoria} onClick={() => void consultarHistorial()}>Consultar historial <Icon name="arrow" /></button></div></div>
    </div>
    <section className="card table-card admin-directory" aria-busy={cargando}>
      <nav className="admin-tabs" aria-label="Gestión de usuarios y áreas">
        <button type="button" aria-pressed={vista === "usuarios"} onClick={() => setVista("usuarios")}><Icon name="users" />Directorio de usuarios</button>
        <button type="button" aria-pressed={vista === "areas"} onClick={() => setVista("areas")}><Icon name="reports" />Áreas municipales</button>
        {vista === "historial" && <button type="button" aria-pressed="true" disabled><Icon name="clock" />Historial</button>}
      </nav>
      {vista === "usuarios" && <div className="admin-directory-body">
        <div className="admin-heading"><span className="admin-symbol"><Icon name="clipboard" /></span><div><h3>Directorio de usuarios</h3><p>Consulta los perfiles y su estado administrativo.</p></div></div>
        <div className="admin-filters">
          <label className="search"><Icon name="search" /><input aria-label="Buscar usuarios" placeholder="Buscar nombre, usuario, rol o área…" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }} /></label>
          <label>Rol<select value={filtroRol} onChange={e => { setFiltroRol(e.target.value); setPagina(1) }}><option value="">Todos los roles</option>{roles.map(r => <option key={r}>{r}</option>)}</select></label>
          <label>Área<select value={filtroArea} onChange={e => { setFiltroArea(e.target.value); setPagina(1) }}><option value="">Todas las áreas</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
          <label>Estado<select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(1) }}><option value="">Todos los estados</option><option value="habilitado">Habilitado</option><option value="deshabilitado">Deshabilitado</option></select></label>
        </div>
        {cargando ? <div className="empty" role="status">Consultando directorio…</div> : registros.length ? <>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Directorio de usuarios"><table>
            <thead><tr><th>Nombre</th><th>Usuario</th><th>Área</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>{registros.map(persona => <tr key={persona.id}>
              <td><div className="admin-person"><span className="admin-avatar" aria-hidden="true">{persona.nombre_completo.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join("")}</span><strong>{persona.nombre_completo}</strong></div></td>
              <td>{persona.usuario}</td><td>{nombresArea.get(persona.area_id) || "Área no disponible"}</td>
              <td><span className={`admin-role admin-role-${persona.rol.toLowerCase()}`}>{persona.rol}</span></td>
              <td><span className={`admin-state ${persona.habilitado ? "admin-state-enabled" : ""}`}>{persona.habilitado ? "Habilitado" : "Deshabilitado"}</span></td>
              <td><details className="admin-row-actions"><summary aria-label={`Acciones para ${persona.nombre_completo}`}>⋮</summary><button type="button" onClick={e => { if (e.currentTarget.parentElement instanceof HTMLDetailsElement) e.currentTarget.parentElement.open = false; abrir(persona) }} disabled={!configuracion?.edicion_habilitada}>Editar perfil</button></details></td>
            </tr>)}</tbody>
          </table></div>
          <div className="pagination admin-pagination"><span>Mostrando {desde + 1}–{desde + registros.length} de {visibles.length}</span><div>
            <label>Por página <select value={porPagina} onChange={e => { setPorPagina(Number(e.target.value)); setPagina(1) }}>{[10, 25, 50].map(n => <option key={n}>{n}</option>)}</select></label>
            <button type="button" className="outline" aria-label="Página anterior" onClick={() => setPagina(paginaActual - 1)} disabled={paginaActual === 1}>‹</button>
            <span aria-live="polite">Página {paginaActual} de {totalPaginas}</span>
            <button type="button" className="outline" aria-label="Página siguiente" onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual === totalPaginas}>›</button>
          </div></div>
        </> : <div className="empty"><Icon name="users" /><h3>{error ? "Directorio no disponible" : "Sin usuarios para mostrar"}</h3>{!error && <p>{consulta || filtroRol || filtroArea || filtroEstado ? "Ajusta la búsqueda o los filtros." : "Los perfiles registrados aparecerán aquí."}</p>}</div>}
      </div>}
      {vista === "areas" && <div className="admin-directory-body"><h3>Áreas municipales</h3><p className="help">Solo se pueden asignar áreas activas.</p><div className="admin-areas">{areas.map(dependencia => <span className="admin-area" key={dependencia.id}>{dependencia.nombre} · <Badge>{dependencia.activo ? "Activa" : "Inactiva"}</Badge></span>)}</div>{!cargando && !areas.length && <p className="help">No hay áreas disponibles.</p>}</div>}
      {vista === "historial" && <div className="admin-directory-body"><h3>Historial administrativo</h3>{cargandoAuditoria && <p role="status">Consultando historial…</p>}{errorAuditoria && <p role="alert" className="auth-error">{errorAuditoria}</p>}{auditoria && (auditoria.length ? <ul className="real-history">{auditoria.map(a => <li key={a.id}>{a.accion} · {usuarios.find(u => u.id === a.usuario_id)?.usuario || a.usuario_id} · {new Date(a.fecha_registro).toLocaleString("es-PE", { timeZone: "America/Lima" })} · Por {usuarios.find(u => u.id === a.actor_id)?.usuario || a.actor_id}</li>)}</ul> : <p>Sin cambios administrativos registrados.</p>)}</div>}
    </section>
    {edicion && <div className="overlay"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="admin-titulo"><button className="close" aria-label="Cerrar formulario" disabled={guardando} onClick={() => { setEdicion(null); setError("") }}>×</button><h2 id="admin-titulo">{edicion === "invitar" ? "Invitar usuario" : "Editar perfil"}</h2><form onSubmit={guardar}>
      <label>Nombre completo<input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={150} disabled={guardando} /></label>
      <label>Usuario<input value={usuario} onChange={(e) => setUsuario(e.target.value)} required minLength={3} maxLength={80} pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]*" disabled={guardando} /></label>
      {edicion === "invitar" && <label>Correo institucional<input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required maxLength={254} disabled={guardando} /></label>}
      <div className="form-row"><label>Rol<select value={rol} onChange={(e) => setRol(e.target.value as Rol)} disabled={guardando || propiasCredenciales}>{roles.map((opcion) => <option key={opcion}>{opcion}</option>)}</select></label><label>Área<select value={area} onChange={(e) => setArea(e.target.value)} required disabled={guardando}><option value="">Seleccionar área</option>{areas.filter((a) => a.activo || a.id === area).map((a) => <option key={a.id} value={a.id} disabled={!a.activo}>{a.nombre}{!a.activo ? " (inactiva)" : ""}</option>)}</select></label></div>
      {edicion !== "invitar" && <label className="checkline"><input type="checkbox" checked={habilitado} onChange={(e) => setHabilitado(e.target.checked)} disabled={guardando || propiasCredenciales} />Perfil habilitado</label>}
      {propiasCredenciales && <p className="help">Tu rol y habilitación se protegen para conservar el acceso de la jefatura.</p>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="outline" disabled={guardando} onClick={() => { setEdicion(null); setError("") }}>Cancelar</button><button type="submit" className="primary" disabled={guardando}>{guardando ? "Guardando…" : edicion === "invitar" ? "Enviar invitación" : "Guardar cambios"}</button></div>
    </form></section></div>}
  </div>
}
