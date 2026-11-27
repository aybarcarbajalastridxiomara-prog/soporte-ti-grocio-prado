import { useEffect, useRef, useState, type FormEvent } from "react"
import { cambiarClaveReal, consultarUsuarioAuth, sesionReal, type PerfilReal } from "./api"
import { Icon } from "./RealUI"
import type { TemaReal } from "./RealApp"

function CampoCuenta({ nombre, valor, icono }: { nombre: string; valor: string; icono: string }) {
  return <label>{nombre}<span className="account-input"><Icon name={icono} /><input readOnly value={valor} /></span></label>
}

export default function RealAccount({ token, perfil, actualizar, cargando, alCambiarClave, tema, cambiarTema }: {
  token: string; perfil: PerfilReal; actualizar: () => Promise<void>; cargando: boolean; alCambiarClave: () => void
  tema: TemaReal; cambiarTema: (preferencia: TemaReal) => void
}) {
  const [correo, setCorreo] = useState("")
  const [errorCorreo, setErrorCorreo] = useState("")
  const [ultimoAcceso, setUltimoAcceso] = useState("")
  const [actual, setActual] = useState("")
  const [nueva, setNueva] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const [mostrar, setMostrar] = useState<string[]>([])
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
  const montado = useRef(true)
  useEffect(() => { montado.current = true; return () => { montado.current = false } }, [])
  useEffect(() => {
    let vigente = true
    setCorreo(""); setErrorCorreo(""); setUltimoAcceso("")
    consultarUsuarioAuth(token).then(u => {
      if (!vigente) return
      if (u.id !== perfil.id) { setErrorCorreo("La identidad de Auth no coincide con tu perfil."); return }
      setCorreo(u.email || "")
      const acceso = u.last_sign_in_at ? new Date(u.last_sign_in_at) : null
      if (acceso && Number.isFinite(acceso.getTime())) {
        setUltimoAcceso(acceso.toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" }))
      }
    }).catch(e => { if (vigente) setErrorCorreo(e instanceof Error ? e.message : "No se pudo consultar el correo.") })
    return () => { vigente = false }
  }, [token, perfil.id])
  async function cambiar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (ocupado) return
    if (nueva !== confirmacion) { setError("La nueva contraseña y su confirmación deben coincidir."); return }
    setOcupado(true); setError("")
    try {
      await cambiarClaveReal(token, perfil.id, actual, nueva)
      if (montado.current && sesionReal.esSesionActual(token)) alCambiarClave()
    } catch (fallo) { if (montado.current) setError(fallo instanceof Error ? fallo.message : "No se confirmó el cambio de contraseña.") }
    finally { if (montado.current) { setActual(""); setNueva(""); setConfirmacion(""); setMostrar([]); setOcupado(false) } }
  }
  const iniciales = perfil.nombre_completo.trim().split(/\s+/).slice(0, 2).map(parte => parte[0]).join("").toUpperCase()
  const secciones = [{ id: "datos", titulo: "Información de la cuenta", icono: "user" },
    { id: "seguridad", titulo: "Seguridad", icono: "login-lock" },
    { id: "preferencias", titulo: "Preferencias", icono: "login-monitor" }]
  const claves = [{ id: "actual", titulo: "Contraseña actual", valor: actual, cambiar: setActual },
    { id: "nueva", titulo: "Nueva contraseña", valor: nueva, cambiar: setNueva },
    { id: "confirmar", titulo: "Confirmar nueva contraseña", valor: confirmacion, cambiar: setConfirmacion }]
  return <div className="real-account">
    <div className="page-title-row institutional-hero">
      <div className="institutional-heading"><Icon name="user" /><div><h2>Mi cuenta</h2><p>Consulta tu perfil y gestiona tus credenciales y preferencias.</p></div></div>
      <button className="outline" disabled={cargando || ocupado} onClick={() => void actualizar()}><Icon name="refresh" />Actualizar perfil</button>
    </div>
    <section className="card account-summary" aria-label="Resumen de la cuenta">
      <span className="account-avatar" aria-hidden="true">{iniciales}</span>
      <div className="account-identity"><h3>{perfil.nombre_completo}</h3><span className="account-role"><Icon name="login-shield" />{perfil.rol}</span><p>{perfil.area_nombre || "Área no disponible"}</p></div>
      <div className="account-last-access"><Icon name="clock" /><div>Último acceso<time>{ultimoAcceso || "Sin dato disponible"}</time></div></div>
    </section>
    <nav className="card account-sections" aria-label="Secciones de Mi cuenta">
      {secciones.map(({ id, titulo, icono }) => <button type="button" key={id} onClick={() => { const seccion = document.getElementById(`cuenta-${id}`); seccion?.focus(); seccion?.scrollIntoView({ block: "nearest" }) }}><Icon name={icono} />{titulo}</button>)}
    </nav>
    <div className="account-grid real-account-grid">
      <section id="cuenta-datos" tabIndex={-1} className="card real-form account-pane">
        <div className="account-pane-title"><Icon name="clipboard" /><div><h3>Datos personales</h3><p>Información de tu perfil en el sistema.</p></div></div>
        <div className="account-pane-content">
          <CampoCuenta nombre="Nombre completo" valor={perfil.nombre_completo} icono="user" />
          <CampoCuenta nombre="Nombre de usuario" valor={perfil.usuario} icono="user" />
          <CampoCuenta nombre="Correo electrónico" valor={correo || (errorCorreo ? "Correo no disponible" : "Sin correo visible")} icono="login-mail" />
          {errorCorreo && <p role="alert" className="field-error">{errorCorreo}</p>}
          <div className="form-row"><CampoCuenta nombre="Área municipal" valor={perfil.area_nombre || "Área no disponible"} icono="reports" /><CampoCuenta nombre="Rol" valor={perfil.rol} icono="users" /></div>
          <p className="account-state-label">Estado de cuenta</p>
          <p className={`account-state${perfil.habilitado ? " enabled" : ""}`}><Icon name="check" />{perfil.habilitado ? "Habilitado" : "Deshabilitado"}</p>
          <p className="notice">El Jefe de Sistemas administra el área, el rol y el estado de la cuenta.</p>
        </div>
      </section>
      <div className="account-secondary">
        <section id="cuenta-seguridad" tabIndex={-1} className="card real-form account-pane">
          <div className="account-pane-title"><Icon name="login-lock" /><div><h3>Seguridad de la cuenta</h3><p>Actualiza tu contraseña de acceso.</p></div></div>
          <form className="account-pane-content" onSubmit={cambiar}>
            {claves.map(({ id, titulo, valor, cambiar }) => <div key={id} className="account-password">
              <label htmlFor={`clave-${id}`}>{titulo}</label>
              <div className="account-input"><Icon name="tool" /><input id={`clave-${id}`} type={mostrar.includes(id) ? "text" : "password"} autoComplete={id === "actual" ? "current-password" : "new-password"} required minLength={id === "actual" ? undefined : 12} value={valor} onChange={e => cambiar(e.target.value)} disabled={ocupado} />
                <button type="button" aria-label={`${mostrar.includes(id) ? "Ocultar" : "Mostrar"} ${titulo.toLowerCase()}`} disabled={ocupado} onClick={() => setMostrar(mostrar.includes(id) ? mostrar.filter(campo => campo !== id) : [...mostrar, id])}><Icon name={mostrar.includes(id) ? "login-eye-off" : "login-eye"} /></button>
              </div>
            </div>)}
            <p className="notice">Usa al menos 12 caracteres. Después del cambio, inicia sesión con tu nueva contraseña.</p>
            {error && <p role="alert" className="auth-error">{error}</p>}
            <button className="primary" type="submit" disabled={ocupado || !correo || Boolean(errorCorreo)}><Icon name="tool" />{ocupado ? "Actualizando…" : "Cambiar contraseña"}</button>
          </form>
        </section>
        <section id="cuenta-preferencias" tabIndex={-1} className="card account-pane">
          <div className="account-pane-title"><Icon name="login-monitor" /><div><h3>Preferencias</h3><p>Personaliza la interfaz en este navegador.</p></div></div>
          <div className="account-pane-content account-preference"><strong>Tema de la interfaz</strong><div className="account-theme">
            {(["claro", "oscuro"] as const).map(opcion => <button type="button" key={opcion} aria-pressed={tema === opcion} onClick={() => cambiarTema(opcion)}>{opcion === "claro" ? "Claro" : "Oscuro"}</button>)}
          </div></div>
        </section>
      </div>
    </div>
  </div>
}
