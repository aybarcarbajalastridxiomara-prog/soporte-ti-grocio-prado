import { useEffect, useRef, useState, type FormEvent } from "react"
import { cambiarClaveReal, consultarUsuarioAuth, sesionReal, type PerfilReal } from "./api"
import { Icon } from "./RealUI"

export default function RealAccount({ token, perfil, actualizar, cargando, alCambiarClave }: { token: string; perfil: PerfilReal; actualizar: () => Promise<void>; cargando: boolean; alCambiarClave: () => void }) {
  const [correo, setCorreo] = useState("")
  const [errorCorreo, setErrorCorreo] = useState("")
  const [actual, setActual] = useState("")
  const [nueva, setNueva] = useState("")
  const [confirmacion, setConfirmacion] = useState("")
  const [mostrar, setMostrar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState("")
  const montado = useRef(true)
  useEffect(() => { montado.current = true; return () => { montado.current = false } }, [])
  useEffect(() => {
    let vigente = true
    setCorreo(""); setErrorCorreo("")
    consultarUsuarioAuth(token).then(u => {
      if (!vigente) return
      if (u.id !== perfil.id) { setErrorCorreo("La identidad de Auth no coincide con tu perfil."); return }
      setCorreo(u.email || "")
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
    finally { if (montado.current) { setActual(""); setNueva(""); setConfirmacion(""); setMostrar(false); setOcupado(false) } }
  }
  return <><div className="page-title-row"><div><h2>Mi cuenta</h2><p>Datos del perfil autenticado y seguridad de acceso.</p></div><button className="outline" disabled={cargando || ocupado} onClick={() => void actualizar()}>Actualizar perfil</button></div><div className="account-grid real-account-grid">
    <section className="card real-form"><h3>Mis datos</h3><label>Nombre completo<input readOnly value={perfil.nombre_completo} /></label><label>Nombre de usuario<input readOnly value={perfil.usuario} /></label><label>Correo electrónico<input readOnly value={correo} placeholder={errorCorreo ? "Correo no disponible" : "Consultando Auth…"} /></label>{errorCorreo && <p role="alert" className="field-error">{errorCorreo}</p>}<div className="form-row"><label>Área municipal<input readOnly value={perfil.area_nombre || "Área no disponible"} /></label><label>Rol<input readOnly value={perfil.rol} /></label></div><label>Estado de cuenta<input readOnly value={perfil.habilitado ? "Habilitado" : "Deshabilitado"} /></label><p className="help">Los datos administrativos son de solo lectura para el propio usuario.</p></section>
    <section className="card real-form"><h3>Seguridad</h3><form onSubmit={cambiar}><label>Contraseña actual<div className="password-field"><input aria-label="Contraseña actual" type={mostrar ? "text" : "password"} autoComplete="current-password" required value={actual} onChange={e => setActual(e.target.value)} disabled={ocupado} /><button type="button" disabled={ocupado} onClick={() => setMostrar(!mostrar)}>{mostrar ? "Ocultar" : "Mostrar"}</button></div></label><label>Nueva contraseña<input type="password" autoComplete="new-password" required minLength={12} value={nueva} onChange={e => setNueva(e.target.value)} disabled={ocupado} /></label><label>Confirmar nueva contraseña<input type="password" autoComplete="new-password" required minLength={12} value={confirmacion} onChange={e => setConfirmacion(e.target.value)} disabled={ocupado} /></label><p className="help">Usa al menos 12 caracteres. Verificaremos tu contraseña actual con Supabase Auth. Tras el cambio deberás iniciar sesión nuevamente.</p>{error && <p role="alert" className="auth-error">{error}</p>}<button className="primary" type="submit" disabled={ocupado || !correo || Boolean(errorCorreo)}><Icon name="check" />{ocupado ? "Verificando y actualizando…" : "Cambiar contraseña"}</button></form></section>
  </div></>
}
