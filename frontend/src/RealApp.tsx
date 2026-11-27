import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import {
  iniciarSesionReal, consultarPerfilReal, listarIncidenciasReales, consultarResumenReal, sesionReal,
  recibirEnlaceAuthReal, establecerClaveInvitada, consultarUsuarioAuth,
  solicitarRecuperacionReal, completarRecuperacionReal, recuperacionHabilitada, cerrarSesionReal,
  consultarAvisosAsignacion, type AvisoAsignacion,
  type PerfilReal, type IncidenciaReal, type SesionReal, type ResumenReal,
} from "./api"
import RealRegister from "./RealRegister"
import RealTicketDetail from "./RealTicketDetail"
import RealAdministration from "./RealAdministration"
import RealDashboard from "./RealDashboard"
import RealAccount from "./RealAccount"
import RealAssignmentsPage from "./RealAssignmentsPage"
import RealWork from "./RealWork"
import RealReports from "./RealReports"
import { Icon } from "./RealUI"
import escudoGrocioPrado from "./assets/escudo-grocio-prado.png"
import "./RealLogin.css"

const estiloFormularios = import.meta.env.VITE_ESTILO_FORMULARIOS === "false" ? "" : " forms-refresh"

export type VistaReal = "dashboard" | "incidencias" | "asignaciones" | "atencion" | "usuarios" | "cuenta" | "registro" | "reportes"
export type TemaReal = "claro" | "oscuro"
const titulos: Record<VistaReal, string> = {
  dashboard: "Panel principal", incidencias: "Incidencias", asignaciones: "Asignaciones",
  atencion: "Atención técnica", usuarios: "Usuarios y áreas", cuenta: "Mi cuenta", registro: "Registrar incidencia",
  reportes: "Reportes",
}
const errorTexto = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la consulta."

function PantallaAcceso({ titulo, descripcion, icono, children }: {
  titulo: string; descripcion: string; icono?: string; children: ReactNode
}) {
  const encabezado = useRef<HTMLHeadingElement>(null)
  const solicitud = icono === "login-mail"
  useEffect(() => {
    if (icono) encabezado.current?.focus()
  }, [titulo, icono])

  return <main className={`login-screen real-app real-access${icono ? " real-access-flow" : ""}${solicitud ? " real-access-request" : ""}`}>
    <header className="real-access-brand">
      <div className="real-access-scene" aria-hidden="true">
        <div className="real-access-photo" />
        <div className="real-access-wave" />
      </div>
      <div className="real-access-brand-content">
        <div className="real-access-municipio">
          <span className="real-access-seal" aria-hidden="true"><img src={escudoGrocioPrado} alt="" /></span>
          <div>Municipalidad Distrital de<strong>Grocio Prado</strong></div>
        </div>
        <p className="real-access-chip"><Icon name="login-monitor" /> Soporte TI</p>
        <h1>Sistema de Gestión<br className="real-access-title-break" /> de Incidencias</h1>
        <p className="real-access-intro">Registro, seguimiento y atención de solicitudes de soporte tecnológico.</p>
        <ul className="real-access-features">
          <li><span><Icon name="login-ticket" /></span>Registra<br /> incidencias</li>
          <li><span><Icon name="users" /></span>Seguimiento<br /> de atención</li>
          <li><span><Icon name="login-bars" /></span>Reportes<br /> e indicadores</li>
        </ul>
      </div>
    </header>
    <div className="real-access-card-area">
      <section className="login-panel" aria-labelledby="real-access-title">
        <div className="login-copy">
          <div className="real-access-support-icon" aria-hidden="true">
            <span className="real-access-laptop"><Icon name={solicitud ? "login-lock" : icono ?? "login-headset"} /></span>
            {icono && <span className="real-access-illustration-badge"><Icon name={solicitud ? "login-mail" : "login-shield"} /></span>}
          </div>
          <div className="real-access-copy-text">
            <h2 id="real-access-title" ref={encabezado} tabIndex={icono ? -1 : undefined}>{titulo}</h2>
            <p>{descripcion}</p>
          </div>
        </div>
        {children}
        {!icono && <footer className="real-access-note">
          <Icon name="login-shield" />
          <p>Acceso exclusivo para personal autorizado<br className="real-access-title-break" /> de la Municipalidad Distrital de Grocio Prado.</p>
        </footer>}
      </section>
    </div>
  </main>
}

function CampoClaveNueva({ id, etiqueta, valor, guardar, ocupado, ayuda }: {
  id: string; etiqueta: string; valor: string; guardar: (valor: string) => void; ocupado: boolean; ayuda?: string
}) {
  const [visible, setVisible] = useState(false)
  return <>
    <label htmlFor={id}><Icon name="login-lock" /> {etiqueta}<span className="real-access-required" aria-hidden="true">*</span></label>
    <div className="password-field real-access-field">
      <span aria-hidden="true"><Icon name="login-lock" /></span>
      <input id={id} type={visible ? "text" : "password"} value={valor} onChange={e => guardar(e.target.value)}
        placeholder={ayuda ? "Ingresa una nueva contraseña" : "Vuelve a ingresar tu contraseña"}
        autoComplete="new-password" aria-describedby={ayuda} required minLength={12} disabled={ocupado} />
      <button type="button" aria-label={`${visible ? "Ocultar" : "Mostrar"} ${etiqueta.toLowerCase()}`}
        aria-controls={id} disabled={ocupado} onClick={() => setVisible(!visible)}>
        <Icon name={visible ? "login-eye" : "login-eye-off"} />
      </button>
    </div>
  </>
}

function CampanaNotificaciones({ token, usuarioId, recibeAsignaciones, abrir }: {
  token: string; usuarioId: string; recibeAsignaciones: boolean; abrir: (t: IncidenciaReal) => void
}) {
  const clave = "grocio-prado.avisos." + usuarioId
  const [leidos, setLeidos] = useState<string[]>(() => {
    try {
      const guardados: unknown = JSON.parse(localStorage.getItem(clave) ?? "[]")
      return Array.isArray(guardados) ? guardados.filter((id): id is string => typeof id === "string").slice(0, 100) : []
    } catch { return [] }
  })
  const [avisos, setAvisos] = useState<AvisoAsignacion[]>([])
  const [estado, setEstado] = useState("Consultando asignaciones…")
  const menu = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (!recibeAsignaciones) return
    let vigente = true
    let consulta: AbortController | undefined
    async function actualizar() {
      if (document.visibilityState === "hidden" || consulta) return
      const control = new AbortController()
      consulta = control
      try {
        const datos = await consultarAvisosAsignacion(token, AbortSignal.any([control.signal, AbortSignal.timeout(20_000)]))
        if (vigente) { setAvisos(datos); setEstado("") }
      } catch {
        if (vigente) setEstado("No se pudieron consultar los avisos. Se reintentará automáticamente.")
      } finally { consulta = undefined }
    }
    void actualizar()
    const intervalo = window.setInterval(actualizar, 30_000)
    window.addEventListener("focus", actualizar)
    document.addEventListener("visibilitychange", actualizar)
    return () => {
      vigente = false
      consulta?.abort()
      window.clearInterval(intervalo)
      window.removeEventListener("focus", actualizar)
      document.removeEventListener("visibilitychange", actualizar)
    }
  }, [token, recibeAsignaciones])

  const pendientes = recibeAsignaciones ? avisos.filter(aviso => !leidos.includes(aviso.id)).length : 0
  function ver(aviso: AvisoAsignacion) {
    const nuevos = [aviso.id, ...leidos.filter(id => id !== aviso.id)].slice(0, 100)
    setLeidos(nuevos)
    try { localStorage.setItem(clave, JSON.stringify(nuevos)) } catch { /* Conserva la lectura durante esta sesión. */ }
    if (menu.current) menu.current.open = false
    abrir(aviso.incidencia)
  }
  return <details className="assignment-notifications" ref={menu}>
    <summary aria-label={"Notificaciones, " + pendientes + " sin leer"}><Icon name="bell" />{pendientes > 0 && <span aria-hidden="true">{pendientes}</span>}</summary>
    <div className="card assignment-notification-panel">
      <h2>Notificaciones</h2>
      {!recibeAsignaciones && <p>No tienes notificaciones.</p>}
      {recibeAsignaciones && estado && <p role="status">{estado}</p>}
      {recibeAsignaciones && !estado && !avisos.length && <p>No tienes asignaciones activas de Jefatura.</p>}
      {recibeAsignaciones && avisos.length > 0 && <ul>{avisos.map(aviso => <li key={aviso.id}>
        <button type="button" data-sin-leer={!leidos.includes(aviso.id)} onClick={() => ver(aviso)}>
          <Icon name="login-ticket" />
          <span><strong>{aviso.incidencia.codigo} · {aviso.incidencia.asunto}</strong>
            <small>{new Date(aviso.fecha_asignacion).toLocaleString("es-PE", { timeZone: "America/Lima" })}{!leidos.includes(aviso.id) && " · Sin leer"}</small></span>
        </button>
      </li>)}</ul>}
    </div>
  </details>
}

export default function RealApp() {
  const [tema, setTema] = useState<TemaReal>(() => {
    try { return localStorage.getItem("grocio-prado.tema") === "oscuro" ? "oscuro" : "claro" }
    catch { return "claro" }
  })
  function cambiarTema(preferencia: TemaReal) {
    setTema(preferencia)
    try { localStorage.setItem("grocio-prado.tema", preferencia) } catch { /* Mantener la elección en esta sesión. */ }
  }
  const [correo, setCorreo] = useState("")
  const [contrasena, setContrasena] = useState("")
  const [mostrarClave, setMostrarClave] = useState(false)
  const [sesion, setSesion] = useState<SesionReal | null>(null)
  const [perfil, setPerfil] = useState<PerfilReal | null>(null)
  const [incidencias, setIncidencias] = useState<IncidenciaReal[]>([])
  const [resumen, setResumen] = useState<ResumenReal | null>(null)
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState("")
  const [vista, setVista] = useState<VistaReal>("dashboard")
  const [ticketSeleccionado, setTicketSeleccionado] = useState<IncidenciaReal | null>(null)
  const [menu, setMenu] = useState(false)
  const [actualizado, setActualizado] = useState("")
  const [activando, setActivando] = useState(false)
  const [avisoAcceso, setAvisoAcceso] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const [recuperando, setRecuperando] = useState(false)
  const [solicitandoEnlace, setSolicitandoEnlace] = useState(false)
  const [identidadRecuperacion, setIdentidadRecuperacion] = useState("")
  const generacion = useRef(0)
  const botonMenu = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menu) return
    const cerrar = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(false); botonMenu.current?.focus() } }
    window.addEventListener("keydown", cerrar)
    return () => window.removeEventListener("keydown", cerrar)
  }, [menu])

  function limpiarSesion() {
    generacion.current++
    sesionReal.limpiar()
    setSesion(null); setPerfil(null); setIncidencias([]); setResumen(null)
    setTicketSeleccionado(null); setVista("dashboard"); setMenu(false)
    setContrasena(""); setMostrarClave(false); setCargando(false); setActualizado("")
    setActivando(false); setConfirmacion("")
    setRecuperando(false); setIdentidadRecuperacion("")
  }

  async function salir() {
    if(cargando) return
    const token=sesion?.access_token
    setCargando(true)
    let aviso=""
    if(token) try { await cerrarSesionReal(token) } catch(error) { aviso=errorTexto(error) }
    limpiarSesion();setCorreo("");setMensaje(aviso)
  }

  useEffect(() => {
    sesionReal.alExpirar = () => {
      limpiarSesion()
      setMensaje("La sesión terminó y no pudo renovarse. Inicia sesión nuevamente.")
    }
    return () => { sesionReal.alExpirar = null }
  }, [])

  useEffect(() => {
    try {
      const enlace = recibirEnlaceAuthReal()
      if (!enlace) return
      const invitacion = enlace.sesion
      if (enlace.tipo === "recovery") {
        setRecuperando(true); setSesion(invitacion); setCargando(true)
        void consultarUsuarioAuth(invitacion.access_token).then(usuario => setIdentidadRecuperacion(usuario.id))
          .catch(error => { limpiarSesion(); setMensaje(errorTexto(error)) }).finally(() => setCargando(false))
        return
      }
      setActivando(true); setCargando(true)
      const vigente = generacion.current
      void consultarPerfilReal(invitacion.access_token).then((autorizado) => {
        if (vigente !== generacion.current) return
        setSesion(invitacion); setPerfil(autorizado)
      }).catch((error: unknown) => { limpiarSesion(); setMensaje(errorTexto(error)) })
        .finally(() => setCargando(false))
    } catch (error) { limpiarSesion(); setMensaje(errorTexto(error)) }
  }, [])

  useEffect(() => {
    if (!sesion) return
    const comprobar = () => {
      void sesionReal.obtenerToken(sesion.access_token).catch((error: unknown) => setMensaje(errorTexto(error)))
    }
    const intervalo = window.setInterval(comprobar, 30000)
    window.addEventListener("focus", comprobar)
    return () => { window.clearInterval(intervalo); window.removeEventListener("focus", comprobar) }
  }, [sesion])

  async function cargarDatos(token: string) {
    const vigente = generacion.current
    const [lista, conteos] = await Promise.allSettled([
      listarIncidenciasReales(token), consultarResumenReal(token),
    ])
    if (vigente !== generacion.current) return
    const errores: string[] = []
    if (lista.status === "fulfilled") {
      setIncidencias(lista.value)
      setActualizado(new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" }))
    } else errores.push(errorTexto(lista.reason))
    if (conteos.status === "fulfilled") setResumen(conteos.value)
    else { setResumen(null); errores.push(`Indicadores no disponibles: ${errorTexto(conteos.reason)}`) }
    if (errores.length) setMensaje([...new Set(errores)].join(" "))
  }

  async function ingresar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (cargando) return
    setCargando(true); setMensaje(""); setAvisoAcceso("")
    const vigente = generacion.current
    try {
      const nueva = await iniciarSesionReal(correo, contrasena)
      setContrasena("")
      const autorizado = await consultarPerfilReal(nueva.access_token)
      if (!autorizado.habilitado) throw new Error("Tu usuario no está habilitado.")
      if (vigente !== generacion.current) return
      setSesion(nueva); setPerfil(autorizado)
      await cargarDatos(nueva.access_token)
    } catch (error) {
      limpiarSesion()
      setMensaje(errorTexto(error))
    } finally { setCargando(false) }
  }

  async function actualizar() {
    if (!sesion || cargando) return
    setCargando(true); setMensaje("")
    try {
      const vigente = generacion.current
      const autorizado = await consultarPerfilReal(sesion.access_token)
      if (vigente !== generacion.current) return
      setPerfil(autorizado)
      await cargarDatos(sesion.access_token)
    } catch (error) { setMensaje(errorTexto(error)) }
    finally { setCargando(false) }
  }

  function navegar(destino: VistaReal) {
    setVista(destino); setTicketSeleccionado(null); setMensaje(""); setMenu(false)
    if (menu) window.requestAnimationFrame(() => botonMenu.current?.focus())
  }

  function abrirTicket(ticket: IncidenciaReal) {
    setMensaje(""); setTicketSeleccionado(ticket)
  }

  async function activarCuenta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!sesion || cargando) return
    if (contrasena.length < 12 || contrasena !== confirmacion) {
      setMensaje("Usa al menos 12 caracteres y confirma la misma contraseña.")
      return
    }
    setCargando(true); setMensaje("")
    try {
      await establecerClaveInvitada(sesion.access_token, contrasena)
      await cerrarSesionReal(sesion.access_token).catch(() => undefined)
      limpiarSesion()
      setAvisoAcceso("Cuenta activada. Ya puedes iniciar sesión.")
    } catch (error) { setMensaje(errorTexto(error)) }
    finally { setCargando(false) }
  }

  async function recuperarClave(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (cargando || !sesion || !identidadRecuperacion) return
    if (contrasena !== confirmacion) { setMensaje("Las contraseñas deben coincidir."); return }
    setCargando(true); setMensaje("")
    try {
      await completarRecuperacionReal(sesion.access_token, identidadRecuperacion, contrasena)
      limpiarSesion()
      setAvisoAcceso("Contraseña actualizada. Ya puedes iniciar sesión.")
    } catch (error) { setMensaje(errorTexto(error)) }
    finally { setContrasena(""); setConfirmacion(""); setCargando(false) }
  }

  async function solicitarEnlace(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (cargando || !recuperacionHabilitada) return
    setCargando(true); setMensaje(""); setAvisoAcceso("")
    try { setAvisoAcceso(await solicitarRecuperacionReal(correo)) }
    catch (error) { setMensaje(errorTexto(error)) }
    finally { setCargando(false) }
  }

  function volverALogin() {
    if (recuperando || activando) limpiarSesion()
    setSolicitandoEnlace(false); setMensaje(""); setAvisoAcceso("")
  }

  const volver = <button type="button" className="text-button real-access-back" disabled={cargando} onClick={volverALogin}>
    <Icon name="arrow-left" /> Volver al inicio de sesión
  </button>

  if (recuperando || activando) {
    const titulo = activando ? "Activa tu cuenta institucional" : "Restablecer contraseña"
    return <PantallaAcceso titulo={titulo} icono={activando ? "user-add" : "login-lock"}
      descripcion={activando ? "Crea la contraseña con la que accederás a Soporte TI." : "Elige una contraseña nueva para tu cuenta de Soporte TI."}>
      <form onSubmit={activando ? activarCuenta : recuperarClave}>
        <CampoClaveNueva id="access-new-password" etiqueta="Nueva contraseña" valor={contrasena}
          guardar={setContrasena} ocupado={cargando} ayuda="access-password-help" />
        <CampoClaveNueva id="access-confirm-password" etiqueta="Confirmar contraseña" valor={confirmacion}
          guardar={setConfirmacion} ocupado={cargando} />
        <div id="access-password-help" className="real-access-requirements">
          <Icon name="login-shield" />
          <div><strong>Requisitos de la contraseña</strong><ul>
            <li><Icon name="check" />Mínimo 12 caracteres.</li>
            <li><Icon name="check" />La confirmación debe coincidir.</li>
          </ul></div>
        </div>
        {mensaje && <div className="auth-error" role="alert">{mensaje}</div>}
        <div className="real-access-flow-actions">
          <button type="submit" className="primary login-submit" disabled={cargando || (activando ? !perfil : !identidadRecuperacion)}>
            <Icon name="check" /> {cargando ? "Procesando…" : activando ? "Activar cuenta" : "Guardar contraseña"}
          </button>
          {volver}
        </div>
      </form>
    </PantallaAcceso>
  }

  if (solicitandoEnlace && !sesion) return <PantallaAcceso titulo="Recuperar acceso" icono="login-mail"
    descripcion="Ingresa el correo asociado a tu cuenta institucional. Te enviaremos un enlace para restablecer tu contraseña.">
    <form onSubmit={solicitarEnlace}>
      <label htmlFor="access-recovery-email"><Icon name="login-mail" /> Correo electrónico institucional<span className="real-access-required" aria-hidden="true">*</span></label>
      <div className="real-access-field">
        <span aria-hidden="true"><Icon name="login-mail" /></span>
        <input id="access-recovery-email" type="email" autoComplete="username" required disabled={cargando}
          value={correo} onChange={e => setCorreo(e.target.value)} placeholder="correo@municipalidad.gob.pe" />
      </div>
      {!recuperacionHabilitada && <p className="real-access-help" role="status">La recuperación por correo no está disponible en este momento. Contacta a Soporte TI.</p>}
      {avisoAcceso && <p className="real-access-success" role="status"><Icon name="check" />{avisoAcceso}</p>}
      {mensaje && <div className="auth-error" role="alert">{mensaje}</div>}
      <button type="submit" className="primary login-submit" disabled={cargando || !recuperacionHabilitada}>
        <Icon name="send" /> {cargando ? "Enviando…" : "Enviar enlace de recuperación"}
      </button>
      <div className="real-access-request-back">{volver}</div>
    </form>
  </PantallaAcceso>

  if (!sesion || !perfil) return (
    <PantallaAcceso titulo="Bienvenido" descripcion="Ingresa con tu cuenta institucional para acceder al sistema de soporte TI.">
      <form onSubmit={ingresar}>
        <label htmlFor="real-access-email"><Icon name="login-mail" /> Correo electrónico</label>
        <div className="real-access-field">
          <span aria-hidden="true"><Icon name="login-mail" /></span>
          <input id="real-access-email" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="correo@municipalidad.gob.pe" autoComplete="username" required disabled={cargando} />
        </div>
        <label htmlFor="real-access-password"><Icon name="login-lock" /> Contraseña</label>
        <div className="password-field real-access-field">
          <span aria-hidden="true"><Icon name="login-lock" /></span>
          <input id="real-access-password" type={mostrarClave ? "text" : "password"} value={contrasena} onChange={(e) => setContrasena(e.target.value)} placeholder="Ingresa tu contraseña" autoComplete="current-password" required disabled={cargando} />
          <button type="button" aria-label={mostrarClave ? "Ocultar contraseña" : "Mostrar contraseña"} aria-controls="real-access-password" onClick={() => setMostrarClave(!mostrarClave)}>
            <Icon name={mostrarClave ? "login-eye" : "login-eye-off"} />
          </button>
        </div>
        <div className="real-access-assistance">
          <button type="button" className="text-button" aria-describedby={recuperacionHabilitada ? undefined : "real-access-recovery-note"} onClick={() => { setSolicitandoEnlace(true); setMensaje(""); setAvisoAcceso(""); setContrasena(""); setMostrarClave(false) }}>¿Olvidaste tu contraseña?</button>
          {!recuperacionHabilitada && <span id="real-access-recovery-note" className="real-access-visually-hidden">Recuperación por correo pendiente de configurar y validar con el operador.</span>}
        </div>
        {avisoAcceso && <p className="real-access-success" role="status"><Icon name="check" />{avisoAcceso}</p>}
        {mensaje && <div className="auth-error" role="alert">{mensaje}</div>}
        <button type="submit" className="primary login-submit" disabled={cargando}><Icon name="login-enter" /> {cargando ? "Verificando acceso…" : "Iniciar sesión"}</button>
      </form>
    </PantallaAcceso>
  )

  const jefe = perfil.rol === "JEFE"
  const representante = perfil.rol === "REPRESENTANTE"
  const tecnico = ["JEFE", "ASISTENTE", "PRACTICANTE"].includes(perfil.rol)
  const opciones: { vista: VistaReal; icono: string }[] = [
    { vista: "dashboard", icono: "dashboard" }, { vista: "incidencias", icono: "login-ticket" },
    ...(representante ? [{ vista: "registro" as const, icono: "plus" }] : []),
    ...(jefe ? [{ vista: "asignaciones" as const, icono: "users" }] : []),
    ...(tecnico ? [{ vista: "atencion" as const, icono: "sidebar-wrench" }] : []),
    ...(jefe ? [{ vista: "usuarios" as const, icono: "users" }] : []),
    ...(jefe ? [{ vista: "reportes" as const, icono: "login-bars" }] : []),
    { vista: "cuenta", icono: "user" },
  ]
  const vistaPermitida = (!["usuarios", "asignaciones", "reportes"].includes(vista) || jefe) && (vista !== "atencion" || tecnico) && (vista !== "registro" || representante)
  const iniciales = perfil.nombre_completo.split(" ").filter(Boolean).map((x) => x[0]).slice(0, 2).join("")

  return (
    <main className={`app-shell real-app${estiloFormularios}`} data-tema={tema}>
      {menu && <button className="sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setMenu(false)} />}
      <aside id="menu-principal" className={`sidebar real-sidebar${menu ? " open" : ""}`}>
        <div className="real-sidebar-municipio">
          <span className="real-access-seal" aria-hidden="true"><img src={escudoGrocioPrado} alt="" /></span>
          <div><span>Municipalidad Distrital de</span><strong>Grocio Prado</strong></div>
        </div>
        <nav aria-label="Navegación principal">
          {opciones.map(({ vista: destino, icono }) => (
            <button type="button" key={destino} className={`nav-item${vista === destino ? " active" : ""}`} aria-current={vista === destino ? "page" : undefined} onClick={() => navegar(destino)}>
              <Icon name={icono} />
              {destino === "incidencias" && representante ? "Mis incidencias" : destino === "atencion" && !jefe ? "Mis atenciones" : titulos[destino]}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button type="button" className="profile-mini account-trigger" onClick={() => navegar("cuenta")}>
            <div className="avatar">{iniciales}</div>
            <div><b>{perfil.nombre_completo}</b><span>{perfil.rol}</span></div>
            <Icon name="arrow" />
          </button>
          <button type="button" className="profile-switch" onClick={() => void salir()}><Icon name="sidebar-power" /> Cerrar sesión</button>
        </div>
      </aside>
      <section className="content">
        <header className="topbar real-topbar">
          <button ref={botonMenu} className="menu-button" aria-label={menu ? "Cerrar menú" : "Abrir menú"} aria-expanded={menu} aria-controls="menu-principal" onClick={() => setMenu(!menu)}>☰</button>
          <div className="real-topbar-title">
            <Icon name={vista === "incidencias" ? "login-ticket" : vista === "atencion" ? "sidebar-wrench" : "shell-home"} />
            <div><p className="breadcrumb">Sistema de Gestión de Incidencias</p><h1>{ticketSeleccionado ? "Detalle de incidencia" : titulos[vista]}</h1></div>
          </div>
          <div className="top-actions"><span className="connection-label"><i />Acceso institucional</span>
            <CampanaNotificaciones key={perfil.id} token={sesion.access_token} usuarioId={perfil.id} recibeAsignaciones={perfil.rol === "ASISTENTE" || perfil.rol === "PRACTICANTE"} abrir={ticket => { navegar("incidencias"); abrirTicket(ticket) }} />
            <button className="avatar avatar-button" aria-label="Abrir mi cuenta" onClick={() => navegar("cuenta")}>{iniciales}</button>
          </div>
        </header>
        <div className="page">
          {mensaje && <div className="notice real-message" role="status">{mensaje}</div>}
          {!vistaPermitida ? <div className="card empty"><h2>Esta sección requiere otro rol</h2><button className="outline" onClick={() => navegar("dashboard")}>Volver al panel</button></div> : vista === "usuarios" && jefe ? <RealAdministration token={sesion.access_token} perfil={perfil} /> : vista === "cuenta" ? (
            <RealAccount token={sesion.access_token} perfil={perfil} tema={tema} cambiarTema={cambiarTema} alCambiarClave={() => { limpiarSesion(); setMensaje("Contraseña actualizada. Inicia sesión con tu nueva contraseña.") }} />
          ) : vista === "registro" && representante ? (
            <RealRegister token={sesion.access_token} perfil={perfil} onCancelar={() => navegar("incidencias")} onCreada={async (ticket, verDetalle) => {
              navegar("incidencias")
              if (verDetalle) abrirTicket(ticket)
              setMensaje(`Incidencia ${ticket.codigo} registrada correctamente.`)
              await cargarDatos(sesion.access_token)
            }} />
          ) : ticketSeleccionado ? (
            <RealTicketDetail token={sesion.access_token} ticket={ticketSeleccionado} rol={perfil.rol} onVolver={() => { setTicketSeleccionado(null); void actualizar() }} />
          ) : vista === "reportes" && jefe ? (
            <RealReports token={sesion.access_token} abrirDetalle={abrirTicket} />
          ) : vista === "asignaciones" ? (
            <RealAssignmentsPage token={sesion.access_token} incidencias={incidencias} cargando={cargando} actualizado={actualizado} actualizar={() => void actualizar()} abrirDetalle={abrirTicket} />
          ) : vista === "atencion" ? (
            <RealWork token={sesion.access_token} abrirDetalle={abrirTicket} />
          ) : (
            <RealDashboard key={vista} vista={vista} perfil={perfil} incidencias={incidencias} resumen={resumen} cargando={cargando} actualizado={actualizado} actualizar={() => void actualizar()} navegar={navegar} abrirDetalle={abrirTicket} />
          )}
        </div>
      </section>
    </main>
  )
}
