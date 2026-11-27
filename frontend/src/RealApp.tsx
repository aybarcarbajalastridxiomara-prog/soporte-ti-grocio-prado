import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  iniciarSesionReal, consultarPerfilReal, listarIncidenciasReales, consultarResumenReal, sesionReal,
  recibirEnlaceAuthReal, establecerClaveInvitada, consultarUsuarioAuth,
  solicitarRecuperacionReal, completarRecuperacionReal, recuperacionHabilitada, cerrarSesionReal,
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
  const [cuentaActivada, setCuentaActivada] = useState(false)
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
    setCargando(true); setMensaje(""); setCuentaActivada(false)
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
      setCuentaActivada(true)
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
      limpiarSesion(); setMensaje("Auth confirmó la contraseña nueva. Inicia sesión nuevamente.")
    } catch (error) { setMensaje(errorTexto(error)) }
    finally { setContrasena(""); setConfirmacion(""); setCargando(false) }
  }

  if (recuperando) return <main className={`login-screen real-app${estiloFormularios}`}><section className="login-panel"><h2>Restablecer contraseña</h2><p>Se actualizará únicamente tu cuenta existente mediante Supabase Auth.</p><form onSubmit={recuperarClave}><label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} required value={contrasena} disabled={cargando} onChange={e => setContrasena(e.target.value)} /></label><label>Confirmar contraseña<input type="password" autoComplete="new-password" minLength={12} required value={confirmacion} disabled={cargando} onChange={e => setConfirmacion(e.target.value)} /></label>{mensaje && <p role="alert" className="auth-error">{mensaje}</p>}<button className="primary" disabled={cargando || !identidadRecuperacion}>Guardar contraseña nueva</button><button type="button" className="outline" disabled={cargando} onClick={() => { limpiarSesion(); setMensaje("") }}>Volver al login</button></form></section></main>

  if (solicitandoEnlace && !sesion) return <main className={`login-screen real-app${estiloFormularios}`}><section className="login-panel"><h2>Recuperar acceso</h2><p>Supabase Auth gestiona el enlace de recuperación; no se crean cuentas ni se modifican roles.</p>{!recuperacionHabilitada && <p role="status">El envío está deshabilitado hasta que el operador valide el correo y las redirecciones de Auth. Contacta a la jefatura.</p>}<form onSubmit={async e => { e.preventDefault(); if(cargando) return; setCargando(true); setMensaje(""); try { setMensaje(await solicitarRecuperacionReal(correo)) } catch(error) { setMensaje(errorTexto(error)) } finally { setCargando(false) } }}><label>Correo electrónico<input type="email" autoComplete="username" required value={correo} disabled={cargando} onChange={e => setCorreo(e.target.value)} /></label>{mensaje && <p role="status">{mensaje}</p>}<button className="primary" disabled={cargando || !recuperacionHabilitada}>Solicitar enlace</button><button type="button" className="outline" disabled={cargando} onClick={() => { setSolicitandoEnlace(false); setMensaje("") }}>Volver al login</button></form></section></main>

  if (activando) return <main className={`login-screen real-app${estiloFormularios}`}><section className="login-panel"><div className="login-copy"><h2>Activa tu cuenta institucional</h2><p>Establece una contraseña para acceder con tu correo.</p></div><form onSubmit={activarCuenta}><label>Nueva contraseña<input type="password" autoComplete="new-password" required minLength={12} value={contrasena} onChange={(e) => setContrasena(e.target.value)} disabled={cargando} /></label><label>Confirmar contraseña<input type="password" autoComplete="new-password" required minLength={12} value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} disabled={cargando} /></label>{mensaje && <div className="auth-error" role="alert">{mensaje}</div>}<button className="primary login-submit" disabled={cargando || !perfil}>{cargando ? "Verificando…" : "Activar cuenta"}</button><button type="button" className="outline" disabled={cargando} onClick={() => { limpiarSesion(); setMensaje("") }}>Volver al login</button></form></section></main>

  if (!sesion || !perfil) return (
    <main className="login-screen real-app real-access">
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
              <span className="real-access-laptop"><Icon name="login-headset" /></span>
            </div>
            <h2 id="real-access-title">Bienvenido</h2>
            <p>Ingresa con tu cuenta institucional para acceder al sistema de soporte TI.</p>
          </div>
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
              <button type="button" className="text-button" aria-describedby={recuperacionHabilitada ? undefined : "real-access-recovery-note"} onClick={() => { setSolicitandoEnlace(true); setMensaje("") }}>¿Olvidaste tu contraseña?</button>
              {!recuperacionHabilitada && <span id="real-access-recovery-note" className="real-access-visually-hidden">Recuperación por correo pendiente de configurar y validar con el operador.</span>}
            </div>
            {cuentaActivada && <p role="status">Cuenta activada. Ya puedes iniciar sesión.</p>}
            {mensaje && <div className="auth-error" role="alert">{mensaje}</div>}
            <button type="submit" className="primary login-submit" disabled={cargando}><Icon name="login-enter" /> {cargando ? "Verificando acceso…" : "Iniciar sesión"}</button>
          </form>
          <footer className="real-access-note">
            <Icon name="login-shield" />
            <p>Acceso exclusivo para personal autorizado<br className="real-access-title-break" /> de la Municipalidad Distrital de Grocio Prado.</p>
          </footer>
        </section>
      </div>
    </main>
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
          <div className="top-actions"><span className="connection-label"><i />Acceso institucional</span><button className="avatar avatar-button" aria-label="Abrir mi cuenta" onClick={() => navegar("cuenta")}>{iniciales}</button></div>
        </header>
        <div className="page">
          {mensaje && <div className="notice real-message" role="status">{mensaje}</div>}
          {!vistaPermitida ? <div className="card empty"><h2>Esta sección requiere otro rol</h2><button className="outline" onClick={() => navegar("dashboard")}>Volver al panel</button></div> : vista === "usuarios" && jefe ? <RealAdministration token={sesion.access_token} perfil={perfil} /> : vista === "cuenta" ? (
            <RealAccount token={sesion.access_token} perfil={perfil} actualizar={actualizar} cargando={cargando} tema={tema} cambiarTema={cambiarTema} alCambiarClave={() => { limpiarSesion(); setMensaje("Contraseña actualizada. Inicia sesión con tu nueva contraseña.") }} />
          ) : vista === "registro" && representante ? (
            <RealRegister token={sesion.access_token} perfil={perfil} onCancelar={() => navegar("incidencias")} onCreada={async (codigo) => { navegar("incidencias"); setMensaje(`Incidencia ${codigo} registrada correctamente.`); await cargarDatos(sesion.access_token) }} />
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
