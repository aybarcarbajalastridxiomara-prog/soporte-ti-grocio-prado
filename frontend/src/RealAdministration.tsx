import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { solicitarAPI, type PerfilReal, type Rol } from "./api"
import { Badge, Icon } from "./RealUI"

type Area = { id: string; nombre: string; activo: boolean }
type Configuracion = { permisos_verificados?: boolean; edicion_habilitada: boolean; invitaciones_habilitadas: boolean; gestion_ampliada?: boolean; motivos: string[] }
type Persona = PerfilReal & { archivado?: boolean; correo?: string | null; activacion?: "ACTIVADA" | "PENDIENTE" | "DESCONOCIDA" }
const acciones = {
  reenviar: "Reenviar invitación de activación", recuperar: "Enviar recuperación de contraseña",
  habilitar: "Rehabilitar usuario", deshabilitar: "Deshabilitar usuario",
  restaurar: "Restaurar sin habilitar", restaurar_habilitado: "Restaurar y habilitar", eliminar: "Eliminar definitivamente",
}
type Accion = keyof typeof acciones
const iconosAccion: Record<Accion, string> = {
  reenviar: "login-mail", recuperar: "login-mail", habilitar: "user-add",
  deshabilitar: "login-lock", restaurar: "refresh", restaurar_habilitado: "user-add", eliminar: "trash",
}
const advertencias: Record<Accion, string> = {
  reenviar: "Se enviará un nuevo enlace al correo registrado.",
  recuperar: "Se enviará un enlace de recuperación al correo registrado.",
  habilitar: "Se permitirá el acceso al sistema según el rol actual.",
  deshabilitar: "Se bloqueará su acceso y dejará de estar disponible para nuevas asignaciones.",
  restaurar: "El perfil volverá al directorio y su acceso seguirá deshabilitado.",
  restaurar_habilitado: "El perfil volverá al directorio con el acceso habilitado. Si la cuenta está pendiente, el usuario aún debe completar la activación.",
  eliminar: "Se eliminarán la cuenta de Auth y el perfil si carecen de dependencias históricas. Esta acción es irreversible.",
}
const roles: Rol[] = ["JEFE", "ASISTENTE", "PRACTICANTE", "REPRESENTANTE"]
const rolesInvitables = roles.filter(rol => rol !== "JEFE")
const areaInformaticaNombre = "Unidad de Racionalización e Informática"

function normalizarUsuario(valor: string) {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function sugerirUsuario(nombre: string, ocupados: Set<string>) {
  const palabras = normalizarUsuario(nombre).split(/\s+/).map(palabra => palabra.replace(/[^a-z0-9]/g, "")).filter(Boolean)
  if (palabras.length < 2) return ""
  const base = `${palabras[0].slice(0, 37)}.${palabras[palabras.length - 1].slice(0, 37)}`
  let sugerencia = base
  for (let sufijo = 2; ocupados.has(sugerencia); sufijo++) sugerencia = `${base}${sufijo}`
  return sugerencia
}

const mensajeError = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la operación."
const iniciales = (nombre: string) => nombre.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join("")
const estado = (persona: Persona) => persona.archivado ? "Archivado" : persona.habilitado ? "Habilitado" : "Deshabilitado"
const activacion = (persona: Persona) => persona.activacion === "ACTIVADA" ? "Activada" : persona.activacion === "PENDIENTE" ? "Pendiente de activación" : "Sin confirmar"

function MenuPerfil({ persona, propio, configuracion, abrir, pedirAccion }: {
  persona: Persona
  propio: boolean
  configuracion: Configuracion | null
  abrir: (persona: Persona, lectura?: boolean) => void
  pedirAccion: (persona: Persona, accion: Accion) => void
}) {
  const menu = useRef<HTMLDivElement>(null)
  const menuId = `admin-menu-${persona.id}`
  const ampliada = configuracion?.gestion_ampliada === true
  const autorizado = configuracion?.edicion_habilitada === true
  const editar = autorizado && !persona.archivado
  const enlace = persona.activacion === "ACTIVADA" ? "recuperar" : "reenviar"
  const mostrarEnlace = autorizado && !persona.archivado
  const administrar = autorizado && !propio
  const requiereMigracion = "Disponible cuando se aplique la migración de Gestión de usuarios."
  function elegir(accion: () => void) {
    menu.current?.hidePopover()
    accion()
  }
  function opcion(accion: Accion, motivo?: string) {
    return <button type="button" className={`admin-menu-${accion}`} disabled={Boolean(motivo)} title={motivo} onClick={() => elegir(() => pedirAccion(persona, accion))}>
      <Icon name={iconosAccion[accion]} />{acciones[accion]}
    </button>
  }
  return <>
    <button type="button" className="admin-menu-trigger" popoverTarget={menuId} aria-label={`Acciones para ${persona.nombre_completo}`} onClick={evento => {
      const panel = menu.current
      if (!panel || panel.matches(":popover-open")) return
      const ancla = evento.currentTarget.getBoundingClientRect()
      const alto = (1 + Number(editar) + Number(mostrarEnlace) + (administrar ? (persona.archivado ? 3 : 2) : 0)) * 42 + (administrar ? 56 : 14)
      const espacioAbajo = window.innerHeight - ancla.bottom - 10
      const arriba = espacioAbajo < alto && ancla.top - 10 > espacioAbajo
      panel.style.left = `${Math.max(8, Math.min(ancla.right - 236, window.innerWidth - 244))}px`
      panel.style.top = arriba ? "auto" : `${ancla.bottom + 4}px`
      panel.style.bottom = arriba ? `${window.innerHeight - ancla.top + 4}px` : "auto"
      panel.style.maxHeight = `${arriba ? ancla.top - 10 : espacioAbajo}px`
    }}>⋮</button>
    <div ref={menu} id={menuId} popover="auto" className="admin-action-menu"
      role="group" aria-label={`Acciones de ${persona.nombre_completo}`}>
      <div className="admin-menu-group">
        <button type="button" onClick={() => elegir(() => abrir(persona, true))}><Icon name="login-eye" />Ver perfil</button>
        {editar && <button className="admin-menu-editar" type="button" onClick={() => elegir(() => abrir(persona))}><Icon name="tool" />Editar perfil</button>}
        {mostrarEnlace && opcion(enlace, !ampliada ? requiereMigracion : !configuracion?.invitaciones_habilitadas ? "El envío de correos está restringido." : !persona.correo ? "La cuenta no tiene correo registrado en Supabase Auth." : undefined)}
      </div>
      {administrar && <>
        <div className="admin-menu-group">
          {persona.archivado ? <>
            {opcion("restaurar_habilitado", ampliada ? undefined : requiereMigracion)}
            {opcion("restaurar", ampliada ? undefined : requiereMigracion)}
          </> : opcion(persona.habilitado ? "deshabilitar" : "habilitar")}
        </div>
        <div className="admin-menu-group">
          {opcion("eliminar", !ampliada ? requiereMigracion : undefined)}
        </div>
      </>}
    </div>
  </>
}

function DialogoAdministrativo({ ocupado, cerrar, children }: { ocupado: boolean; cerrar: () => void; children: ReactNode }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialogo.current?.showModal() }, [])
  return <dialog ref={dialogo} className="modal admin-dialog" aria-labelledby="admin-titulo" onCancel={evento => {
    evento.preventDefault()
    if (!ocupado) cerrar()
  }}>{children}</dialog>
}

export default function RealAdministration({ token, perfil }: { token: string; perfil: PerfilReal }) {
  const [usuarios, setUsuarios] = useState<Persona[]>([])
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
  const [edicion, setEdicion] = useState<Persona | "invitar" | null>(null)
  const [soloLectura, setSoloLectura] = useState(false)
  const [confirmacion, setConfirmacion] = useState<{ persona: Persona; accion: Accion } | null>(null)
  const [nombre, setNombre] = useState("")
  const [usuario, setUsuario] = useState("")
  const [usuarioEditado, setUsuarioEditado] = useState(false)
  const [correo, setCorreo] = useState("")
  const [correoPerfil, setCorreoPerfil] = useState<{ id: string; valor?: string | null; error?: string } | null>(null)
  const [rol, setRol] = useState<Rol>("REPRESENTANTE")
  const [area, setArea] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [auditoria,setAuditoria] = useState<{id:string;accion:string;actor_id:string;usuario_id:string;fecha_registro:string}[]|null>(null)
  const [errorAuditoria,setErrorAuditoria] = useState("")
  const [cargandoAuditoria, setCargandoAuditoria] = useState(false)

  useEffect(() => {
    let vigente = true
    setCargando(true); setError(""); setConfiguracion(null)
    Promise.all([
      solicitarAPI<Persona[]>("/api/usuarios", token),
      solicitarAPI<Area[]>("/api/areas", token),
      solicitarAPI<Configuracion>("/api/administracion/configuracion", token),
    ]).then(([personas, dependencias, config]) => {
      if (!vigente) return
      setUsuarios(personas); setAreas(dependencias); setConfiguracion({ ...config, edicion_habilitada: config.edicion_habilitada && config.permisos_verificados === true, invitaciones_habilitadas: config.invitaciones_habilitadas && config.permisos_verificados === true })
    }).catch((fallo: unknown) => { if (vigente) setError(mensajeError(fallo)) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [token, recarga])

  const perfilAbierto = edicion && edicion !== "invitar" ? edicion.id : null
  useEffect(() => {
    if (!perfilAbierto) return
    const cancelacion = new AbortController()
    solicitarAPI<{ correo: string | null }>(`/api/usuarios/${encodeURIComponent(perfilAbierto)}/correo`, token, { signal: cancelacion.signal })
      .then(({ correo }) => { if (!cancelacion.signal.aborted) setCorreoPerfil({ id: perfilAbierto, valor: correo }) })
      .catch((fallo: unknown) => { if (!cancelacion.signal.aborted) setCorreoPerfil({ id: perfilAbierto, error: mensajeError(fallo) }) })
    return () => cancelacion.abort()
  }, [perfilAbierto, token])

  useEffect(() => {
    function cerrarMenu(evento: Event) {
      const abierto = document.querySelector<HTMLElement>(".admin-action-menu:popover-open")
      if (abierto && !(evento.target instanceof Node && abierto.contains(evento.target))) abierto.hidePopover()
    }
    window.addEventListener("wheel", cerrarMenu, { capture: true, passive: true })
    window.addEventListener("touchmove", cerrarMenu, { capture: true, passive: true })
    window.addEventListener("resize", cerrarMenu)
    return () => {
      window.removeEventListener("wheel", cerrarMenu, true)
      window.removeEventListener("touchmove", cerrarMenu, true)
      window.removeEventListener("resize", cerrarMenu)
    }
  }, [])

  const invitando = edicion === "invitar"
  const areaInformatica = areas.find(a => a.activo && a.nombre === areaInformaticaNombre)
  const invitacionTecnica = invitando && (rol === "ASISTENTE" || rol === "PRACTICANTE")
  const areaSeleccionada = invitacionTecnica ? areaInformatica?.id || "" : area
  const usuarioOcupado = invitando && usuarios.some(persona => persona.usuario.toLowerCase() === usuario)

  function cambiarNombre(valor: string) {
    setNombre(valor)
    if (invitando && !usuarioEditado) {
      setUsuario(sugerirUsuario(valor, new Set(usuarios.map(persona => persona.usuario.toLowerCase()))))
    }
  }

  function abrir(persona: Persona | "invitar", lectura = false) {
    setSoloLectura(lectura)
    setCorreoPerfil(null)
    setUsuarioEditado(false)
    setEdicion(persona); setError(""); setMensaje(""); setCorreo("")
    setNombre(persona === "invitar" ? "" : persona.nombre_completo)
    setUsuario(persona === "invitar" ? "" : persona.usuario)
    setRol(persona === "invitar" ? "REPRESENTANTE" : persona.rol)
    setArea(persona === "invitar" ? "" : persona.area_id)
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando || soloLectura || !edicion || !configuracion) return
    if (edicion === "invitar" ? (!configuracion.invitaciones_habilitadas || usuarioOcupado || !areaSeleccionada) : !configuracion.edicion_habilitada) return
    setGuardando(true); setError(""); setMensaje("")
    try {
      const datos = { nombre_completo: nombre.trim(), usuario: usuario.trim(), rol, area_id: areaSeleccionada }
      const cambios = edicion === "invitar" ? { ...datos, correo: correo.trim() } : {
        ...(datos.nombre_completo !== edicion.nombre_completo && { nombre_completo: datos.nombre_completo }),
        ...(datos.usuario !== edicion.usuario && { usuario: datos.usuario }),
        ...(datos.rol !== edicion.rol && { rol: datos.rol }),
        ...(datos.area_id !== edicion.area_id && { area_id: datos.area_id }),
      }
      if (Object.keys(cambios).length === 0) { setEdicion(null); return }
      await solicitarAPI<PerfilReal>(invitando ? "/api/usuarios/invitar" : `/api/usuarios/${encodeURIComponent(edicion.id)}`, token, {
        method: invitando ? "POST" : "PATCH",
        body: JSON.stringify(cambios),
      })
      setMensaje(invitando ? "Supabase aceptó la invitación y el perfil fue registrado. La entrega del correo y la activación deben confirmarse con el destinatario." : "Perfil actualizado correctamente.")
      setEdicion(null); setRecarga((x) => x + 1)
    } catch (fallo) { setError(mensajeError(fallo)) }
    finally { setGuardando(false) }
  }

  function pedirAccion(persona: Persona, accion: Accion) {
    setError(""); setMensaje("")
    setConfirmacion({ persona, accion })
  }

  async function confirmarAccion() {
    if (!confirmacion || guardando) return
    setGuardando(true); setError("")
    try {
      const resultado = await solicitarAPI<{ mensaje: string }>(`/api/usuarios/${encodeURIComponent(confirmacion.persona.id)}/acciones`, token, {
        method: "POST", body: JSON.stringify({ accion: confirmacion.accion }),
      })
      setConfirmacion(null); setMensaje(resultado.mensaje); setRecarga(x => x + 1)
      if (confirmacion.accion === "restaurar" || confirmacion.accion === "restaurar_habilitado") {
        setFiltroEstado(""); setPagina(1)
      }
    } catch (fallo) { setError(mensajeError(fallo)) }
    finally { setGuardando(false) }
  }

  const propiasCredenciales = edicion !== null && edicion !== "invitar" && edicion.id === perfil.id
  const nombresArea = new Map(areas.map(a => [a.id, a.nombre]))
  const nombresUsuario = new Map(usuarios.map(u => [u.id, u.usuario]))
  const consulta = busqueda.trim().toLocaleLowerCase("es")
  const hayFiltros = Boolean(consulta || filtroRol || filtroArea || filtroEstado)
  const visibles = usuarios.filter(persona =>
    (!filtroRol || persona.rol === filtroRol) &&
    (!filtroArea || persona.area_id === filtroArea) &&
    (filtroEstado === "archivado" ? persona.archivado : !persona.archivado) &&
    (filtroEstado === "pendiente" ? persona.activacion === "PENDIENTE" :
      !filtroEstado || filtroEstado === estado(persona).toLowerCase()) &&
    `${persona.nombre_completo} ${persona.usuario} ${persona.rol} ${nombresArea.get(persona.area_id) || ""}`
      .toLocaleLowerCase("es").includes(consulta)
  )
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / porPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const desde = (paginaActual - 1) * porPagina
  const registros = visibles.slice(desde, desde + porPagina)

  function limpiarFiltros() {
    setBusqueda(""); setFiltroRol(""); setFiltroArea(""); setFiltroEstado(""); setPagina(1)
  }

  async function consultarHistorial() {
    setVista("historial")
    setErrorAuditoria(""); setAuditoria(null); setCargandoAuditoria(true)
    try { setAuditoria(await solicitarAPI<typeof auditoria>("/api/administracion/historial", token)) }
    catch (fallo) { setErrorAuditoria(mensajeError(fallo)) }
    finally { setCargandoAuditoria(false) }
  }

  return <div className="real-admin">
    <section className="real-shell-greeting incident-hero admin-hero">
      <div><h2>Gestión de usuarios y áreas</h2><p>Administra las cuentas, los roles y las áreas municipales.</p></div>
      <div className="real-dashboard-banner-art admin-hero-art" aria-hidden="true">
        <span className="admin-hero-people"><Icon name="users" /></span><span className="admin-hero-shield"><Icon name="login-shield" /></span>
      </div>
    </section>
    {mensaje && <div className="notice" role="status">{mensaje}</div>}
    {!edicion && !confirmacion && error && <div className="auth-error" role="alert">{error}</div>}
    {configuracion && configuracion.motivos.length > 0 && <details className="notice observation-notice admin-warning"><summary>Configuración administrativa pendiente</summary>{configuracion.motivos.map(motivo => <p key={motivo}>{motivo}</p>)}</details>}
    {configuracion?.edicion_habilitada && !configuracion.gestion_ampliada && <div className="notice observation-notice admin-warning">Los estados de activación, el reenvío y la eliminación requieren la migración de gestión de usuarios.</div>}
    <div className="admin-summary">
      <div className="admin-card"><span className="admin-symbol"><Icon name="users" /></span><div><h3>Usuarios registrados</h3><strong>{cargando || error ? "—" : usuarios.length}</strong><button type="button" className="text-button" onClick={() => setVista("usuarios")}>Administrar cuentas <Icon name="arrow" /></button></div></div>
      <div className="admin-card"><span className="admin-symbol"><Icon name="reports" /></span><div><h3>Áreas municipales</h3><strong>{cargando || error ? "—" : areas.length}</strong><button type="button" className="text-button" onClick={() => setVista("areas")}>Consultar áreas <Icon name="arrow" /></button></div></div>
      <div className="admin-card"><span className="admin-symbol"><Icon name="clock" /></span><div><h3>Historial administrativo</h3><p>Cambios registrados en las cuentas</p><button type="button" className="text-button" disabled={cargandoAuditoria} onClick={() => void consultarHistorial()}>Consultar historial <Icon name="arrow" /></button></div></div>
    </div>
    <section className="card table-card admin-directory" aria-busy={cargando}>
      <nav className="admin-tabs" aria-label="Gestión de usuarios y áreas">
        <button type="button" aria-pressed={vista === "usuarios"} onClick={() => setVista("usuarios")}><Icon name="users" />Directorio de usuarios</button>
        <button type="button" aria-pressed={vista === "areas"} onClick={() => setVista("areas")}><Icon name="reports" />Áreas municipales</button>
        <button type="button" aria-pressed={vista === "historial"} disabled={cargandoAuditoria} onClick={() => void consultarHistorial()}><Icon name="clock" />Historial</button>
      </nav>
      <div className="admin-directory-toolbar">
        <div className="admin-heading">
          <span className="admin-symbol"><Icon name={vista === "usuarios" ? "clipboard" : vista === "areas" ? "reports" : "clock"} /></span>
          <div><h3>{vista === "usuarios" ? "Directorio de usuarios" : vista === "areas" ? "Áreas municipales" : "Historial administrativo"}</h3>
            {vista === "usuarios" && !cargando && !error && <p>{visibles.length} {visibles.length === 1 ? "perfil" : "perfiles"}</p>}
            {vista === "areas" && <p>Solo se pueden asignar áreas activas.</p>}
          </div>
        </div>
        <div className="real-actions">
          <button className="outline" onClick={() => { setRecarga(x => x + 1); if (vista === "historial") void consultarHistorial() }} disabled={cargando || cargandoAuditoria}><Icon name="refresh" />Actualizar</button>
          <button className="primary" onClick={() => abrir("invitar")} disabled={cargando || !configuracion?.invitaciones_habilitadas}><Icon name="plus" />Nuevo usuario</button>
        </div>
      </div>
      {vista === "usuarios" && <div className="admin-directory-body">
        <div className="admin-filters">
          <label>Buscar<span className="admin-search-field"><Icon name="search" /><input placeholder="Nombre, usuario, rol o área…" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPagina(1) }} /></span></label>
          <label>Rol<select value={filtroRol} onChange={e => { setFiltroRol(e.target.value); setPagina(1) }}><option value="">Todos los roles</option>{roles.map(r => <option key={r}>{r}</option>)}</select></label>
          <label>Área<select value={filtroArea} onChange={e => { setFiltroArea(e.target.value); setPagina(1) }}><option value="">Todas las áreas</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
          <label>Estado<select value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPagina(1) }}><option value="">Perfiles sin archivar</option><option value="habilitado">Habilitado</option><option value="deshabilitado">Deshabilitado</option>{configuracion?.gestion_ampliada && <><option value="pendiente">Pendiente de activación</option><option value="archivado">Archivado</option></>}</select></label>
        </div>
        {hayFiltros && <button type="button" className="text-button admin-clear" onClick={limpiarFiltros}><Icon name="refresh" />Limpiar filtros</button>}
        {cargando ? <div className="empty" role="status">Consultando directorio…</div> : registros.length ? <>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Directorio de usuarios"><table>
            <thead><tr><th scope="col">Nombre</th><th scope="col">Usuario</th><th scope="col">Área</th><th scope="col">Rol</th><th scope="col">Estado</th>{configuracion?.gestion_ampliada && <th scope="col">Activación</th>}<th scope="col">Acciones</th></tr></thead>
            <tbody>{registros.map(persona => <tr key={persona.id}>
              <td><div className="admin-person"><span className="admin-avatar" aria-hidden="true">{iniciales(persona.nombre_completo)}</span><strong>{persona.nombre_completo}</strong></div></td>
              <td>{persona.usuario}</td><td>{nombresArea.get(persona.area_id) || "Área no disponible"}</td>
              <td><span className={`admin-role admin-role-${persona.rol.toLowerCase()}`}>{persona.rol}</span></td>
              <td><span className={`admin-state ${persona.habilitado ? "admin-state-enabled" : ""}`}>{estado(persona)}</span></td>
              {configuracion?.gestion_ampliada && <td><span className="admin-activation" data-activacion={persona.activacion}>{activacion(persona)}</span></td>}
              <td><MenuPerfil persona={persona} propio={persona.id === perfil.id} configuracion={configuracion} abrir={abrir} pedirAccion={pedirAccion} /></td>
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
      {vista === "areas" && <div className="admin-directory-body">
        <div className="admin-areas">{areas.map(dependencia => <div className="admin-area" key={dependencia.id}><span className="admin-symbol"><Icon name="reports" /></span><strong>{dependencia.nombre}</strong><Badge>{dependencia.activo ? "Activa" : "Inactiva"}</Badge></div>)}</div>
        {!cargando && !areas.length && <p className="help">No hay áreas disponibles.</p>}
      </div>}
      {vista === "historial" && <div className="admin-directory-body">
        {cargandoAuditoria && <p role="status">Consultando historial…</p>}
        {errorAuditoria && <p role="alert" className="auth-error">{errorAuditoria}</p>}
        {auditoria && (auditoria.length ? <ul className="real-history admin-audit-list">{auditoria.map(a => <li key={a.id}>
          <span className="admin-symbol"><Icon name="clock" /></span>
          <div><strong>{a.accion.toLocaleLowerCase("es").replaceAll("_", " ")}</strong><p>{nombresUsuario.get(a.usuario_id) || a.usuario_id} · Por {nombresUsuario.get(a.actor_id) || a.actor_id}</p></div>
          <time dateTime={a.fecha_registro}>{new Date(a.fecha_registro).toLocaleString("es-PE", { timeZone: "America/Lima" })}</time>
        </li>)}</ul> : <p>Sin cambios administrativos registrados.</p>)}
      </div>}
    </section>
    {edicion && <DialogoAdministrativo ocupado={guardando} cerrar={() => { setEdicion(null); setError("") }}>
      <div className="admin-heading admin-dialog-heading">
        <span className="admin-symbol">{edicion === "invitar" ? <Icon name="plus" /> : iniciales(edicion.nombre_completo)}</span>
        <div><h2 id="admin-titulo">{edicion === "invitar" ? "Invitar usuario" : soloLectura ? "Ver perfil" : "Editar perfil"}</h2>
          {edicion !== "invitar" && <p>{edicion.nombre_completo} · {estado(edicion)}{configuracion?.gestion_ampliada ? ` · ${activacion(edicion)}` : ""}</p>}
        </div>
      </div>
      <form onSubmit={guardar}>
        <div className={invitando ? "admin-profile-fields admin-invitation-fields" : "admin-profile-fields"}>
          <label>Nombre completo<input autoFocus={!soloLectura} value={nombre} onChange={e => cambiarNombre(e.target.value)} required maxLength={150} readOnly={soloLectura} disabled={guardando} /></label>
          <label><span id="admin-usuario-etiqueta">Usuario</span><input aria-labelledby="admin-usuario-etiqueta" value={usuario} onChange={e => {
            setUsuarioEditado(true)
            setUsuario(invitando ? normalizarUsuario(e.target.value).replace(/\s/g, "") : e.target.value)
          }} required minLength={3} maxLength={80} pattern={invitando ? "[a-z0-9][a-z0-9_.\\-]*" : "[a-zA-Z0-9][a-zA-Z0-9_.\\-]*"} readOnly={soloLectura} disabled={guardando}
            aria-invalid={usuarioOcupado || undefined} aria-describedby={invitando ? "admin-invitacion-usuario" : undefined} />
            {invitando && <small id="admin-invitacion-usuario" role={usuarioOcupado ? "status" : undefined}>{usuarioOcupado ? "Este usuario ya está registrado." : "Sugerido a partir del nombre. Puedes editarlo."}</small>}
          </label>
          <label className="admin-profile-email"><span><Icon name={edicion === "invitar" ? "login-mail" : "login-lock"} />Correo institucional</span>
            {edicion === "invitar" ? <input type="email" value={correo} onChange={e => setCorreo(e.target.value)} required maxLength={254} disabled={guardando} />
              : <><input value={correoPerfil?.id !== edicion.id ? "Consultando Supabase Auth…" : correoPerfil.error ? "Error de consulta" : correoPerfil.valor || "Sin correo registrado"} readOnly aria-describedby={correoPerfil?.error ? "admin-correo-aviso" : undefined} />
                {correoPerfil?.error && <small id="admin-correo-aviso" role="status">{correoPerfil.error}</small>}</>}
          </label>
          <label>Rol<select value={rol} onChange={e => setRol(e.target.value as Rol)} disabled={guardando || propiasCredenciales || soloLectura}>{(invitando ? rolesInvitables : roles).map(opcion => <option key={opcion}>{opcion}</option>)}</select></label>
          {invitacionTecnica
            ? <label className="admin-invitation-area"><span id="admin-area-etiqueta">Área</span><input aria-labelledby="admin-area-etiqueta" value={areaInformatica?.nombre || "Informática no está disponible"} readOnly />
                <small>{areaInformatica ? "Se asigna automáticamente al personal de Informática." : "El área debe estar activa para enviar la invitación."}</small>
              </label>
            : <label className={invitando ? "admin-invitation-area" : undefined}>Área<select value={area} onChange={e => setArea(e.target.value)} required disabled={guardando || soloLectura}><option value="">Seleccionar área</option>{areas.filter(a => a.activo || (!invitando && a.id === area)).map(a => <option key={a.id} value={a.id}>{a.nombre}{!a.activo ? " (inactiva)" : ""}</option>)}</select></label>}
        </div>
        {propiasCredenciales && !soloLectura && <p className="help">Tu rol se protege para conservar el acceso de la jefatura.</p>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="outline" autoFocus={soloLectura} disabled={guardando} onClick={() => { setEdicion(null); setError("") }}>{soloLectura ? "Cerrar" : "Cancelar"}</button>
          {!soloLectura && <button type="submit" className="primary" disabled={guardando || usuarioOcupado || (invitacionTecnica && !areaInformatica)}>{guardando ? "Guardando…" : edicion === "invitar" ? "Enviar invitación" : "Guardar cambios"}</button>}
        </div>
      </form>
    </DialogoAdministrativo>}
    {confirmacion && <DialogoAdministrativo ocupado={guardando} cerrar={() => { setConfirmacion(null); setError("") }}>
      <h2 id="admin-titulo">{acciones[confirmacion.accion]}</h2>
      <p><strong>{confirmacion.persona.nombre_completo}</strong></p>
      <p>{advertencias[confirmacion.accion]}</p>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="outline" autoFocus disabled={guardando} onClick={() => { setConfirmacion(null); setError("") }}>Cancelar</button>
        <button type="button" className={confirmacion.accion === "eliminar" ? "primary admin-danger-button" : "primary"} disabled={guardando} onClick={() => void confirmarAccion()}>{guardando ? "Procesando…" : "Confirmar"}</button>
      </div>
    </DialogoAdministrativo>}
  </div>
}
