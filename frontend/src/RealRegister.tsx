import { useEffect, useState, type FormEvent } from "react"
import { listarIncidenciasReales, registrarIncidenciaReal, type IncidenciaReal, type PerfilReal } from "./api"
import { Badge, Icon } from "./RealUI"

type Props = { token: string; perfil: PerfilReal; onCancelar: () => void; onCreada: (codigo: string) => Promise<void> }
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
    if (!asunto.trim() || !descripcion.trim()) { setError("El asunto y la descripción son obligatorios."); return }
    if ((hora && !fecha) || fecha > hoyLima()) { setError("Revisa la fecha de inicio: no puede ser futura y la hora requiere una fecha."); return }
    if (fecha && hora && new Date(`${fecha}T${hora}:00-05:00`).getTime() > Date.now()) { setError("La fecha y hora de inicio no pueden estar en el futuro."); return }
    if (reincidente && !cerradas.some(t => t.id === anterior)) { setError("Selecciona una incidencia anterior cerrada de tu área."); return }
    setGuardando(true); setError("")
    try {
      const creada = await registrarIncidenciaReal(token, {
        asunto: asunto.trim(), descripcion: descripcion.trim(), categoria: opcional(categoria),
        equipo_sistema_afectado: opcional(equipo), ubicacion: opcional(ubicacion), impacto: impacto || null,
        fecha_inicio_problema: fecha || null, hora_inicio_problema: hora || null,
        reincidente, incidencia_anterior_id: reincidente ? anterior : null,
        detalle_reincidencia: reincidente ? opcional(antecedente) : null,
      })
      await onCreada(creada.codigo)
    } catch (fallo) { setError(fallo instanceof Error ? fallo.message : "No se pudo registrar la incidencia.") }
    finally { setGuardando(false) }
  }
  return <div className="real-register"><button className="back" onClick={onCancelar} disabled={guardando}>‹ Cancelar y volver</button>
    <div className="detail-header"><div><h2>Registrar nueva incidencia</h2><p>Complete los datos para que Sistemas pueda evaluar el caso.</p></div><Badge>Nuevo registro</Badge></div>
    <form className="register-form real-form" onSubmit={guardar}>
      <fieldset disabled={guardando}><legend>A. Información del solicitante</legend><div className="form-row form-row-three"><label>Área municipal<input value={perfil.area_nombre || "Área no disponible"} readOnly /></label><label>Reportante autorizado<input value={perfil.nombre_completo} readOnly /></label><label>Fecha y hora de registro<input value="Se asignarán al registrar" readOnly /></label></div><p className="help">El código y el estado inicial los asigna el servidor al guardar.</p></fieldset>
      <fieldset disabled={guardando}><legend>B. Descripción de la incidencia</legend><label>Asunto de la incidencia *<input required maxLength={200} value={asunto} onChange={e => setAsunto(e.target.value)} /></label><label>Descripción detallada *<textarea required rows={5} value={descripcion} onChange={e => setDescripcion(e.target.value)} /></label>
        <div className="form-row form-row-three"><label>Categoría provisional<select value={categoria} onChange={e => setCategoria(e.target.value)}><option value="">Seleccione</option>{["Equipos periféricos", "Conectividad", "Acceso a sistemas", "Equipo de cómputo", "Hardware", "Software", "Otros"].map(c => <option key={c}>{c}</option>)}</select></label><label>Equipo o sistema afectado<input maxLength={150} value={equipo} onChange={e => setEquipo(e.target.value)} /></label><label>Oficina o ubicación<input maxLength={150} value={ubicacion} onChange={e => setUbicacion(e.target.value)} /></label></div>
        <div className="form-row"><label>¿Cuándo comenzó el problema?<input type="date" max={hoyLima()} value={fecha} onInput={e => setFecha(e.currentTarget.value)} onChange={e => setFecha(e.target.value)} /></label><label>Hora aproximada<input type="time" value={hora} onInput={e => setHora(e.currentTarget.value)} onChange={e => setHora(e.target.value)} /></label></div>
        <label>¿El problema le impide continuar con sus actividades?<select value={impacto} onChange={e => setImpacto(e.target.value as typeof impacto)}><option value="">No especificado</option><option value="Si">Sí</option><option>Parcialmente</option><option>No</option></select></label><p className="help">Prioridad sugerida: {impacto === "Si" ? "Alta" : impacto === "Parcialmente" ? "Media" : impacto === "No" ? "Baja" : "Pendiente de evaluación"}. Es orientativa; la prioridad oficial la confirma el JEFE.</p>
      </fieldset>
      <fieldset disabled={guardando}><legend>C. Antecedentes del problema</legend><label>¿Este problema ya ocurrió anteriormente?<select value={reincidente ? "Si" : "No"} onChange={e => { setReincidente(e.target.value === "Si"); setAnterior(""); setAntecedente("") }}><option>No</option><option value="Si">Sí</option></select></label>
        {reincidente && <><div className="notice"><p>La recurrencia debe vincularse a una incidencia cerrada de su área. No reabre ni reutiliza el código anterior.</p></div><label>Incidencia anterior cerrada *<select required value={anterior} onChange={e => setAnterior(e.target.value)} disabled={cargandoAnterior || Boolean(errorAnterior)}><option value="">{cargandoAnterior ? "Consultando…" : "Seleccione una incidencia"}</option>{cerradas.map(t => <option key={t.id} value={t.id}>{t.codigo} · {t.asunto}</option>)}</select></label><p className="help">Últimas 100 incidencias cerradas del área.{!cargandoAnterior && !cerradas.length && " No hay antecedentes disponibles para vincular."}</p>{errorAnterior && <p role="alert" className="field-error">{errorAnterior}</p>}<label>Observaciones sobre la falla anterior<textarea maxLength={2000} rows={3} value={antecedente} onChange={e => setAntecedente(e.target.value)} /></label></>}
      </fieldset>
      <fieldset><legend>D. Fotografías y archivos</legend><label className="attachment-pending"><Icon name="clipboard" /><span>Fotografías o documentos</span><input aria-label="Adjuntos pendientes de integración" type="file" disabled accept="image/jpeg,image/png,image/webp,application/pdf" /></label><p className="help">Carga no disponible: el almacenamiento privado y los permisos de archivos siguen pendientes. Esta incidencia se registrará sin adjuntos.</p></fieldset>
      {error && <div className="auth-error" role="alert">{error}</div>}<div className="modal-actions"><button type="button" className="outline" onClick={onCancelar} disabled={guardando}>Cancelar</button><button type="submit" className="primary" disabled={guardando || (reincidente && (!anterior || cargandoAnterior || Boolean(errorAnterior)))}>{guardando ? "Registrando…" : "Registrar incidencia"}</button></div>
    </form>
  </div>
}
