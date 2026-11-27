import { useEffect, useRef, useState, type FormEvent } from "react"
import { consultarAdjuntosRegistro, listarIncidenciasReales, registrarIncidenciaReal, subirAdjuntoReal,
  type ConfiguracionAdjuntos, type IncidenciaReal, type PerfilReal } from "./api"
import { Badge, Icon } from "./RealUI"

type Props = { token: string; perfil: PerfilReal; onCancelar: () => void; onCreada: (ticket: IncidenciaReal, verDetalle: boolean) => Promise<void> }
const opcional = (v: string) => v.trim() || null
const hoyLima = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())

export default function RealRegister({ token, perfil, onCancelar, onCreada }: Props) {
  const [asunto, setAsunto] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [categoria, setCategoria] = useState("")
  const [equipo, setEquipo] = useState("")
  const [ubicacion, setUbicacion] = useState("")
  const [impacto, setImpacto] = useState<"" | "Si" | "Parcialmente" | "No">("")
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")
  const [reincidente, setReincidente] = useState(false)
  const [anterior, setAnterior] = useState("")
  const [antecedente, setAntecedente] = useState("")
  const [cerradas, setCerradas] = useState<IncidenciaReal[]>([])
  const [cargandoAnterior, setCargandoAnterior] = useState(false)
  const [errorAnterior, setErrorAnterior] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [adjuntos, setAdjuntos] = useState<ConfiguracionAdjuntos | null>(null)
  const [errorAdjuntos, setErrorAdjuntos] = useState("")
  const [archivos, setArchivos] = useState<File[]>([])
  const [creada, setCreada] = useState<IncidenciaReal | null>(null)
  const selectorArchivos = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const control = new AbortController()
    consultarAdjuntosRegistro(token, control.signal)
      .then(datos => { if (!control.signal.aborted) setAdjuntos(datos) })
      .catch(() => { if (!control.signal.aborted) setErrorAdjuntos("No se pudo verificar la carga de archivos. Puedes registrar la incidencia y consultar sus adjuntos después.") })
    return () => control.abort()
  }, [token])
  useEffect(() => {
    if (!reincidente) return
    let vigente = true
    setCargandoAnterior(true); setErrorAnterior(""); setCerradas([]); setAnterior("")
    listarIncidenciasReales(token, { estado: "Cerrado", limite: 100 }).then(lista => {
      if (vigente) setCerradas(lista.filter(t => t.area_id === perfil.area_id && t.estado === "Cerrado"))
    }).catch(e => { if (vigente) setErrorAnterior(e instanceof Error ? e.message : "No se pudieron consultar los antecedentes.") })
      .finally(() => { if (vigente) setCargandoAnterior(false) })
    return () => { vigente = false }
  }, [reincidente, token, perfil.area_id])
  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (guardando) return
    if (!creada && (!asunto.trim() || !descripcion.trim())) { setError("El asunto y la descripción son obligatorios."); return }
    if (!creada && ((hora && !fecha) || fecha > hoyLima())) { setError("Revisa la fecha de inicio: no puede ser futura y la hora requiere una fecha."); return }
    if (!creada && fecha && hora && new Date(`${fecha}T${hora}:00-05:00`).getTime() > Date.now()) { setError("La fecha y hora de inicio no pueden estar en el futuro."); return }
    if (!creada && reincidente && !cerradas.some(t => t.id === anterior)) { setError("Selecciona una incidencia anterior cerrada de tu área."); return }
    setGuardando(true); setError("")
    try {
      const ticket = creada ?? await registrarIncidenciaReal(token, {
        asunto: asunto.trim(), descripcion: descripcion.trim(), categoria: opcional(categoria),
        equipo_sistema_afectado: opcional(equipo), ubicacion: opcional(ubicacion), impacto: impacto || null,
        fecha_inicio_problema: fecha || null, hora_inicio_problema: hora || null,
        reincidente, incidencia_anterior_id: reincidente ? anterior : null,
        detalle_reincidencia: reincidente ? opcional(antecedente) : null,
      })
      setCreada(ticket)
      const pendientes: File[] = []
      const fallos: string[] = []
      for (const archivo of archivos) {
        try { await subirAdjuntoReal(token, ticket.id, archivo) }
        catch (fallo) {
          pendientes.push(archivo)
          fallos.push(archivo.name + ": " + (fallo instanceof Error ? fallo.message : "No se confirmó la carga."))
        }
      }
      setArchivos(pendientes)
      if (pendientes.length) {
        setError("La incidencia " + ticket.codigo + " se registró. Quedaron archivos pendientes. " + fallos.join(" "))
        return
      }
      await onCreada(ticket, archivos.length > 0 || Boolean(creada))
    } catch (fallo) { setError(fallo instanceof Error ? fallo.message : "No se pudo registrar la incidencia.") }
    finally { setGuardando(false) }
  }
  function elegirArchivos(seleccion: FileList | null) {
    const nuevos = Array.from(seleccion ?? [])
    const valido = adjuntos && nuevos.length <= 10 && nuevos.every(a => adjuntos.tipos.includes(a.type) && a.size > 0 && a.size <= adjuntos.maximo_bytes)
    setArchivos(valido ? nuevos : [])
    setErrorAdjuntos(valido || !nuevos.length ? "" : "Selecciona hasta diez archivos admitidos dentro del límite indicado.")
  }
  const volver = () => creada ? void onCreada(creada, true) : onCancelar()
  return <div className="real-register"><button className="back" onClick={volver} disabled={guardando}>{creada ? "‹ Ver incidencia registrada" : "‹ Cancelar y volver"}</button>
    <div className="detail-header"><div><span className="register-header-icon"><Icon name="plus" /></span><div><h2>Registrar nueva incidencia</h2><p>Complete los datos para que Sistemas pueda evaluar el caso.</p></div></div><Badge>Nuevo registro</Badge></div>
    <form className="register-form real-form" onSubmit={guardar}>
      <fieldset disabled={guardando || Boolean(creada)}><legend><span className="register-legend-title"><span className="register-section-icon"><Icon name="user" /></span>A. Información del solicitante</span></legend><div className="form-row form-row-three"><label>Área municipal<input value={perfil.area_nombre || "Área no disponible"} readOnly /></label><label>Reportante autorizado<input value={perfil.nombre_completo} readOnly /></label><label>Fecha y hora de registro<input value={creada ? new Date(creada.fecha_registro).toLocaleString("es-PE", { timeZone: "America/Lima" }) : "Se asignarán al registrar"} readOnly /></label></div><p className="help">El código y el estado inicial los asigna el servidor al guardar.</p></fieldset>
      <fieldset disabled={guardando || Boolean(creada)}><legend><span className="register-legend-title"><span className="register-section-icon"><Icon name="clipboard" /></span>B. Descripción de la incidencia</span></legend><label>Asunto de la incidencia *<input required maxLength={200} value={asunto} onChange={e => setAsunto(e.target.value)} /></label><label>Descripción detallada *<textarea required rows={5} value={descripcion} onChange={e => setDescripcion(e.target.value)} /></label>
        <div className="form-row form-row-three"><label>Categoría provisional<select value={categoria} onChange={e => setCategoria(e.target.value)}><option value="">Seleccione</option>{["Equipos periféricos", "Conectividad", "Acceso a sistemas", "Equipo de cómputo", "Hardware", "Software", "Otros"].map(c => <option key={c}>{c}</option>)}</select></label><label>Equipo o sistema afectado<input maxLength={150} value={equipo} onChange={e => setEquipo(e.target.value)} /></label><label>Oficina o ubicación<input maxLength={150} value={ubicacion} onChange={e => setUbicacion(e.target.value)} /></label></div>
        <div className="form-row"><label>¿Cuándo comenzó el problema?<input type="date" max={hoyLima()} value={fecha} onInput={e => setFecha(e.currentTarget.value)} onChange={e => setFecha(e.target.value)} /></label><label>Hora aproximada<input type="time" value={hora} onInput={e => setHora(e.currentTarget.value)} onChange={e => setHora(e.target.value)} /></label></div>
        <label>¿El problema le impide continuar con sus actividades?<select value={impacto} onChange={e => setImpacto(e.target.value as typeof impacto)}><option value="">No especificado</option><option value="Si">Sí</option><option>Parcialmente</option><option>No</option></select></label><p className="help">Prioridad sugerida: {impacto === "Si" ? "Alta" : impacto === "Parcialmente" ? "Media" : impacto === "No" ? "Baja" : "Pendiente de evaluación"}. Es orientativa; la prioridad oficial la confirma el JEFE.</p>
      </fieldset>
      <fieldset disabled={guardando || Boolean(creada)}><legend><span className="register-legend-title"><span className="register-section-icon"><Icon name="login-ticket" /></span>C. Antecedentes del problema</span></legend><label>¿Este problema ya ocurrió anteriormente?<select value={reincidente ? "Si" : "No"} onChange={e => { setReincidente(e.target.value === "Si"); setAnterior(""); setAntecedente("") }}><option>No</option><option value="Si">Sí</option></select></label>
        {reincidente && <><div className="notice"><p>La recurrencia debe vincularse a una incidencia cerrada de su área. No reabre ni reutiliza el código anterior.</p></div><label>Incidencia anterior cerrada *<select required value={anterior} onChange={e => setAnterior(e.target.value)} disabled={cargandoAnterior || Boolean(errorAnterior)}><option value="">{cargandoAnterior ? "Consultando…" : "Seleccione una incidencia"}</option>{cerradas.map(t => <option key={t.id} value={t.id}>{t.codigo} · {t.asunto}</option>)}</select></label><p className="help">Últimas 100 incidencias cerradas del área.{!cargandoAnterior && !cerradas.length && " No hay antecedentes disponibles para vincular."}</p>{errorAnterior && <p role="alert" className="field-error">{errorAnterior}</p>}<label>Observaciones sobre la falla anterior<textarea maxLength={2000} rows={3} value={antecedente} onChange={e => setAntecedente(e.target.value)} /></label></>}
      </fieldset>
      <fieldset disabled={guardando}><legend><span className="register-legend-title"><span className="register-section-icon"><Icon name="download" /></span>D. Fotografías y archivos</span></legend>
        {adjuntos?.carga_habilitada && <><label className="attachment-pending"><Icon name="paperclip" /><span>Seleccionar fotografías o documentos</span><input ref={selectorArchivos} type="file" multiple accept={adjuntos.tipos.join(",")} onChange={e => elegirArchivos(e.target.files)} /></label><p className="help">Hasta diez archivos. Máximo {adjuntos.maximo_bytes / 1_000_000} MB por archivo.</p>
          {(archivos.length > 0 || errorAdjuntos) && <button type="button" className="text-button" onClick={() => {
            if (selectorArchivos.current) selectorArchivos.current.value = ""
            setArchivos([]); setErrorAdjuntos("")
          }}>Quitar selección</button>}</>}
        {archivos.length > 0 && <ul className="register-attachment-list">{archivos.map((archivo, i) => <li key={archivo.name + i}>{archivo.name}</li>)}</ul>}
        {!adjuntos && !errorAdjuntos && <p className="help" role="status">Verificando almacenamiento privado…</p>}
        {adjuntos && !adjuntos.carga_habilitada && <p className="notice">{adjuntos.motivo} Puedes guardar la incidencia y adjuntar después cuando se habilite.</p>}
        {errorAdjuntos && <p className="field-error" role="alert">{errorAdjuntos}</p>}
      </fieldset>
      {error && <div className="auth-error" role="alert">{error}</div>}<div className="modal-actions">
        <button type="button" className="outline" onClick={volver} disabled={guardando}>{creada ? "Ver incidencia" : "Cancelar"}</button>
        <button type="submit" className="primary" disabled={guardando || (creada ? !archivos.length : reincidente && (!anterior || cargandoAnterior || Boolean(errorAnterior))) || Boolean(adjuntos?.carga_habilitada && errorAdjuntos)}>{guardando ? "Guardando…" : creada ? "Reintentar adjuntos" : "Registrar incidencia"}</button>
      </div>
    </form>
  </div>
}
