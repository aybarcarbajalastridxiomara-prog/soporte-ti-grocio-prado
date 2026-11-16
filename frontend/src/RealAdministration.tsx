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
  const [edicion, setEdicion] = useState<PerfilReal | "invitar" | null>(null)
  const [nombre, setNombre] = useState("")
  const [usuario, setUsuario] = useState("")
  const [correo, setCorreo] = useState("")
  const [rol, setRol] = useState<Rol>("REPRESENTANTE")
  const [area, setArea] = useState("")
  const [habilitado, setHabilitado] = useState(true)
  const [guardando, setGuardando] = useState(false)

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
  const visibles = usuarios.filter((persona) => `${persona.nombre_completo} ${persona.usuario} ${persona.rol} ${areas.find((a) => a.id === persona.area_id)?.nombre || ""}`.toLocaleLowerCase("es").includes(busqueda.trim().toLocaleLowerCase("es")))

  return <div className="real-admin">
    <div className="page-title-row"><div><h2>Gestión de usuarios y áreas</h2><p>Administración exclusiva del Jefe de Sistemas.</p></div><div className="real-actions"><button className="outline" onClick={() => setRecarga((x) => x + 1)} disabled={cargando}><Icon name="refresh" />Actualizar</button><button className="primary" onClick={() => abrir("invitar")} disabled={cargando || !configuracion?.invitaciones_habilitadas}><Icon name="plus" />Nuevo usuario</button></div></div>
    {mensaje && <div className="notice" role="status">{mensaje}</div>}
    {!edicion && error && <div className="auth-error" role="alert">{error}</div>}
    {configuracion && configuracion.motivos.length > 0 && <div className="notice observation-notice"><b>Configuración pendiente</b>{configuracion.motivos.map((motivo) => <p key={motivo}>{motivo}</p>)}<p>La consulta de usuarios y áreas permanece disponible. Las invitaciones y Brevo siguen pendientes de configuración y pruebas.</p></div>}
    <section className="card table-card" aria-busy={cargando}>
      <div className="section-head"><div><h3>Directorio de usuarios</h3><p>El estado indica el permiso del perfil. Se muestra el usuario real; los correos de otras cuentas no se consultan en Auth.</p></div><span className="badge slate">{usuarios.length} perfiles</span></div>
      <div className="filters real-filters"><label className="search"><Icon name="search" /><input aria-label="Buscar usuarios" placeholder="Buscar nombre, usuario, rol o área…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} /></label></div>
      {cargando ? <div className="empty" role="status">Consultando directorio…</div> : visibles.length ? <div className="table-wrap" tabIndex={0} role="region" aria-label="Directorio de usuarios"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Área</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visibles.map((persona) => <tr key={persona.id}><td>{persona.nombre_completo}</td><td>{persona.usuario}</td><td>{areas.find((a) => a.id === persona.area_id)?.nombre || "Área no disponible"}</td><td>{persona.rol}</td><td><Badge>{persona.habilitado ? "Habilitado" : "Deshabilitado"}</Badge></td><td><button className="row-action" onClick={() => abrir(persona)} disabled={!configuracion?.edicion_habilitada}>Editar</button></td></tr>)}</tbody></table></div> : <div className="empty"><Icon name="users" /><h3>{error ? "Directorio no disponible" : "Sin usuarios para mostrar"}</h3><p>{busqueda ? "Prueba otro nombre o área." : "Los perfiles autorizados aparecerán aquí."}</p></div>}
    </section>
    <section className="card"><h3>Áreas municipales</h3><p className="help">Solo se pueden asignar áreas activas.</p><div className="admin-areas">{areas.map((dependencia) => <span className="admin-area" key={dependencia.id}>{dependencia.nombre} · <Badge>{dependencia.activo ? "Activa" : "Inactiva"}</Badge></span>)}</div>{!cargando && !areas.length && <p className="help">No hay áreas disponibles.</p>}</section>
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
