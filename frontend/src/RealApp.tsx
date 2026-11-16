import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  iniciarSesionReal, consultarPerfilReal, listarIncidenciasReales, consultarResumenReal, sesionReal,
  recibirInvitacionReal, establecerClaveInvitada,
  type PerfilReal, type IncidenciaReal, type SesionReal, type ResumenReal,
} from "./api"
import RealRegister from "./RealRegister"
import RealTicketDetail from "./RealTicketDetail"
import RealAdministration from "./RealAdministration"
import RealDashboard from "./RealDashboard"
import RealAccount from "./RealAccount"
import RealAssignmentsPage from "./RealAssignmentsPage"
import RealWork from "./RealWork"
import { Icon } from "./RealUI"

export type VistaReal = "dashboard" | "incidencias" | "asignaciones" | "atencion" | "usuarios" | "cuenta" | "registro"
const titulos: Record<VistaReal, string> = {
  dashboard: "Panel principal", incidencias: "Incidencias", asignaciones: "Asignaciones",
  atencion: "Atención técnica", usuarios: "Usuarios y áreas", cuenta: "Mi cuenta", registro: "Registrar incidencia",
}
const errorTexto = (error: unknown) => error instanceof Error ? error.message : "No se pudo completar la consulta."

export default function RealApp() {
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
  const [confirmacion, setConfirmacion] = useState("")
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
      const invitacion = recibirInvitacionReal()
      if (!invitacion) return
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
    setCargando(true); setMensaje("")
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
      setContrasena(""); setConfirmacion(""); setActivando(false)
      await cargarDatos(sesion.access_token)
    } catch (error) { setMensaje(errorTexto(error)) }
    finally { setCargando(false) }
  }

  if (activando) return <main className="login-screen real-app"><section className="login-panel"><div className="login-copy"><h2>Activa tu cuenta institucional</h2><p>Establece una contraseña para acceder con tu correo.</p></div><form onSubmit={activarCuenta}><label>Nueva contraseña<input type="password" autoComplete="new-password" required minLength={12} value={contrasena} onChange={(e) => setContrasena(e.target.value)} disabled={cargando} /></label><label>Confirmar contraseña<input type="password" autoComplete="new-password" required minLength={12} value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} disabled={cargando} /></label>{mensaje && <div className="auth-error" role="alert">{mensaje}</div>}<button className="primary login-submit" disabled={cargando || !perfil}>{cargando ? "Verificando…" : "Activar cuenta"}</button><button type="button" className="outline" disabled={cargando} onClick={() => { limpiarSesion(); setMensaje("") }}>Volver al login</button></form></section></main>

  if (!sesion || !perfil) return (
    <main className="login-screen real-app">
      <section className="login-panel">
        <div className="login-brand"><div className="crest large">TI</div><div><p>Municipalidad Distrital de Grocio Prado</p><h1>Soporte TI</h1></div></div>
        <div className="login-copy"><h2>Bienvenido</h2><p>Inicia sesión con tu cuenta institucional para gestionar las incidencias de tu municipio.</p></div>
        <form onSubmit={ingresar}>
          <label>Correo electrónico<input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="correo@institucion.pe" autoComplete="username" required disabled={cargando} /></label>
          <label>Contraseña<div className="password-field"><input aria-label="Contraseña" type={mostrarClave ? "text" : "password"} value={contrasena} onChange={(e) => setContrasena(e.target.value)} autoComplete="current-password" required disabled={cargando} /><button type="button" onClick={() => setMostrarClave(!mostrarClave)}>{mostrarClave ? "Ocultar" : "Mostrar"}</button></div></label>
          {mensaje && <div className="auth-error" role="alert">{mensaje}</div>}
          <button type="submit" className="primary login-submit" disabled={cargando}>{cargando ? "Verificando acceso…" : "Iniciar sesión"}</button>
        </form>
        <p className="login-foot">Municipalidad Distrital de Grocio Prado · Acceso institucional</p>
      </section>
    </main>
  )

  const jefe = perfil.rol === "JEFE"
  const representante = perfil.rol === "REPRESENTANTE"
  const tecnico = ["JEFE", "ASISTENTE", "PRACTICANTE"].includes(perfil.rol)
  const opciones: { vista: VistaReal; icono: string }[] = [
    { vista: "dashboard", icono: "dashboard" }, { vista: "incidencias", icono: "clipboard" },
    ...(representante ? [{ vista: "registro" as const, icono: "plus" }] : []),
    ...(jefe ? [{ vista: "asignaciones" as const, icono: "users" }] : []),
    ...(tecnico ? [{ vista: "atencion" as const, icono: "tool" }] : []),
    ...(jefe ? [{ vista: "usuarios" as const, icono: "users" }] : []),
    { vista: "cuenta", icono: "user" },
  ]
  const vistaPermitida = (vista !== "usuarios" && vista !== "asignaciones" || jefe) && (vista !== "atencion" || tecnico) && (vista !== "registro" || representante)
  const iniciales = perfil.nombre_completo.split(" ").filter(Boolean).map((x) => x[0]).slice(0, 2).join("")

  return (
    <main className="app-shell real-app">
      {menu && <button className="sidebar-backdrop" aria-label="Cerrar menú" onClick={() => setMenu(false)} />}
      <aside id="menu-principal" className={`sidebar${menu ? " open" : ""}`}>
        <div className="brand"><div className="crest">TI</div><div><strong>Soporte TI</strong><span>Grocio Prado</span></div></div>
        <div className="prototype">GESTIÓN DE INCIDENCIAS</div>
        <nav aria-label="Navegación principal">{opciones.map((opcion) => <button type="button" key={opcion.vista} className={`nav-item${vista === opcion.vista ? " active" : ""}`} aria-current={vista === opcion.vista ? "page" : undefined} onClick={() => navegar(opcion.vista)}><Icon name={opcion.icono} />{opcion.vista === "incidencias" && representante ? "Mis incidencias" : opcion.vista === "atencion" && !jefe ? "Mis atenciones" : titulos[opcion.vista]}</button>)}</nav>
        <div className="sidebar-bottom"><button className="profile-mini account-trigger" onClick={() => navegar("cuenta")}><div className="avatar">{iniciales}</div><div><b>{perfil.nombre_completo}</b><span>{perfil.rol}</span></div></button><button className="profile-switch" onClick={() => { limpiarSesion(); setCorreo(""); setMensaje("") }}>Cerrar sesión</button></div>
      </aside>
      <section className="content">
        <header className="topbar">
          <button ref={botonMenu} className="menu-button" aria-label={menu ? "Cerrar menú" : "Abrir menú"} aria-expanded={menu} aria-controls="menu-principal" onClick={() => setMenu(!menu)}>☰</button>
          <div><p className="breadcrumb">Sistema de Gestión de Incidencias / {titulos[vista]}</p><h1>{ticketSeleccionado ? "Detalle de incidencia" : titulos[vista]}</h1></div>
          <div className="top-actions"><span className="connection-label"><i />Acceso institucional</span><button className="avatar avatar-button" aria-label="Abrir mi cuenta" onClick={() => navegar("cuenta")}>{iniciales}</button></div>
        </header>
        <div className="page">
          {mensaje && <div className="notice real-message" role="status">{mensaje}</div>}
          {!vistaPermitida ? <div className="card empty"><h2>Esta sección requiere otro rol</h2><button className="outline" onClick={() => navegar("dashboard")}>Volver al panel</button></div> : vista === "usuarios" && jefe ? <RealAdministration token={sesion.access_token} perfil={perfil} /> : vista === "cuenta" ? (
            <RealAccount token={sesion.access_token} perfil={perfil} actualizar={actualizar} cargando={cargando} alCambiarClave={() => { limpiarSesion(); setMensaje("Contraseña actualizada. Inicia sesión con tu nueva contraseña.") }} />
          ) : vista === "registro" && representante ? (
            <RealRegister token={sesion.access_token} perfil={perfil} onCancelar={() => navegar("incidencias")} onCreada={async (codigo) => { navegar("incidencias"); setMensaje(`Incidencia ${codigo} registrada correctamente.`); await cargarDatos(sesion.access_token) }} />
          ) : ticketSeleccionado ? (
            <RealTicketDetail token={sesion.access_token} ticket={ticketSeleccionado} rol={perfil.rol} onVolver={() => { setTicketSeleccionado(null); void actualizar() }} />
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
