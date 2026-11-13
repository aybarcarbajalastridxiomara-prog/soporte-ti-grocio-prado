/** Paso 110D3 - Intervencion y cierre con rutas V3/V4 segun ciclo real. */
import { useEffect, useState, type CSSProperties, type FormEvent } from "react"
import { solicitarAPI } from "./api"

type Contexto = {
  incidencia_id: string
  codigo: string
  estado: string
  esquema_v4: boolean
  ciclo_actual: number
  tecnico_responsable_id: string | null
  es_responsable: boolean
  tiene_solucion_final: boolean
  puede_intervenir: boolean
  puede_cerrar: boolean
  ruta_intervencion: string
  ruta_cierre: string
}

type Props = { token: string; ticketId: string; onActualizada: () => void }
const escrituraHabilitada = import.meta.env.VITE_PERMITIR_ATENCION_REAL === "true"
const panel: CSSProperties = {
  background: "#fff", border: "1px solid #dbe5ef", borderRadius: 15,
  padding: 22, display: "grid", gap: 14,
}
const campo: CSSProperties = { display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }
const entrada: CSSProperties = { padding: 11, border: "1px solid #d1deeb", borderRadius: 9, font: "inherit", width: "100%", boxSizing: "border-box" }

function mensajeError(error: unknown) {
  return error instanceof Error ? error.message : "No se pudo completar la operación."
}

export default function RealTechnicalActions({ token, ticketId, onActualizada }: Props) {
  const [contexto, setContexto] = useState<Contexto | null>(null)
  const [diagnostico, setDiagnostico] = useState("")
  const [acciones, setAcciones] = useState("")
  const [solucion, setSolucion] = useState("")
  const [duracion, setDuracion] = useState("")
  const [final, setFinal] = useState(false)
  const [resumenCierre, setResumenCierre] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [exito, setExito] = useState("")
  const [recarga, setRecarga] = useState(0)

  const rutaContexto = `/api/incidencias/${encodeURIComponent(ticketId)}/contexto-atencion`
  useEffect(() => {
    let activo = true
    setContexto(null)
    setCargando(true)
    setError("")
    solicitarAPI<Contexto>(rutaContexto, token)
      .then((datos) => { if (activo) setContexto(datos) })
      .catch((fallo: unknown) => { if (activo) setError(mensajeError(fallo)) })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [rutaContexto, token, recarga])

  async function contextoVigente(): Promise<Contexto> {
    const actual = await solicitarAPI<Contexto>(rutaContexto, token)
    if (!contexto || actual.ciclo_actual !== contexto.ciclo_actual ||
        actual.estado !== contexto.estado ||
        actual.tecnico_responsable_id !== contexto.tecnico_responsable_id) {
      throw new Error("El ticket cambió. Actualiza el contexto antes de continuar.")
    }
    const base = actual.ciclo_actual > 1
      ? `/api/v4/incidencias/${encodeURIComponent(ticketId)}`
      : `/api/incidencias/${encodeURIComponent(ticketId)}`
    if (actual.ruta_intervencion !== `${base}/intervenciones` ||
        actual.ruta_cierre !== `${base}/cerrar`) {
      throw new Error("La ruta de operación no coincide con el ciclo actual.")
    }
    return actual
  }

  async function registrarIntervencion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (ocupado || cargando || !escrituraHabilitada) return
    if (!diagnostico.trim() || !acciones.trim() || (final && !solucion.trim())) {
      setError("Completa el diagnóstico, las acciones y la solución final cuando corresponda.")
      return
    }
    const minutos = duracion.trim() === "" ? null : Number(duracion)
    if (minutos !== null && (!Number.isInteger(minutos) || minutos < 0)) {
      setError("La duración debe ser un número entero no negativo.")
      return
    }
    setOcupado(true); setError(""); setExito("")
    try {
      const actual = await contextoVigente()
      if (!actual.puede_intervenir || !actual.es_responsable) {
        throw new Error("No eres el técnico responsable de un ticket en revisión.")
      }
      await solicitarAPI<unknown>(actual.ruta_intervencion, token, {
        method: "POST",
        body: JSON.stringify({
          diagnostico: diagnostico.trim(),
          acciones_realizadas: acciones.trim(),
          duracion_minutos: minutos,
          solucion_aplicada: solucion.trim() || null,
          es_solucion_final: final,
        }),
      })
      setExito("Atención técnica registrada. Se actualizó el estado del ticket.")
      setDiagnostico(""); setAcciones(""); setSolucion(""); setDuracion(""); setFinal(false)
      setRecarga((n) => n + 1)
      onActualizada()
    } catch (fallo) {
      setError(mensajeError(fallo)); setRecarga((n) => n + 1)
    } finally { setOcupado(false) }
  }

  async function cerrarTicket(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (ocupado || cargando || !escrituraHabilitada) return
    if (resumenCierre.trim().length < 20 || resumenCierre.trim().length > 2000) {
      setError("El resumen de cierre debe contener entre 20 y 2000 caracteres.")
      return
    }
    setOcupado(true); setError(""); setExito("")
    try {
      const actual = await contextoVigente()
      if (!actual.puede_cerrar || !actual.es_responsable || !actual.tiene_solucion_final) {
        throw new Error("Para cerrar, primero registra una solución final válida del ciclo actual.")
      }
      await solicitarAPI<unknown>(actual.ruta_cierre, token, {
        method: "POST", body: JSON.stringify({ resumen_cierre: resumenCierre.trim() }),
      })
      setExito("Incidencia cerrada correctamente. Actualiza el listado para ver el estado.")
      setResumenCierre(""); setRecarga((n) => n + 1)
      onActualizada()
    } catch (fallo) {
      setError(mensajeError(fallo)); setRecarga((n) => n + 1)
    } finally { setOcupado(false) }
  }

  return (
    <section style={panel} aria-label="Atención técnica y cierre">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, color: "#193859" }}>Atención técnica y cierre</h3>
        {contexto && <strong style={{ fontSize: 12, color: "#235da0" }}>
          Ciclo {contexto.ciclo_actual} · {contexto.ciclo_actual > 1 ? "V4" : "V3"}
        </strong>}
      </div>
      {cargando && <p role="status">Comprobando permisos y ciclo...</p>}
      {error && <p role="alert" style={{ color: "#a32929" }}>{error}</p>}
      {exito && <p role="status" style={{ color: "#176a46" }}>{exito}</p>}
      {!escrituraHabilitada && <p style={{ color: "#79591a", fontSize: 13, margin: 0 }}>
        Acciones de escritura deshabilitadas. Solo habilitar en entorno de pruebas autorizado.
      </p>}
      {contexto && !contexto.es_responsable && <p style={{ color: "#57677d", margin: 0 }}>
        Este ticket no está asignado a tu usuario en el ciclo vigente.
      </p>}
      {contexto?.es_responsable && contexto.estado !== "En revisión" && <p style={{ color: "#57677d", margin: 0 }}>
        La incidencia está en estado {contexto.estado}; no admite nuevas atenciones.
      </p>}
      {contexto?.puede_intervenir && (
        <form onSubmit={registrarIntervencion} style={{ display: "grid", gap: 12 }}>
          <h4 style={{ margin: 0 }}>Registrar intervención</h4>
          <label style={campo}>Diagnóstico
            <textarea style={entrada} rows={2} value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} required disabled={ocupado || !escrituraHabilitada} />
          </label>
          <label style={campo}>Acciones realizadas
            <textarea style={entrada} rows={3} value={acciones} onChange={(e) => setAcciones(e.target.value)} required disabled={ocupado || !escrituraHabilitada} />
          </label>
          <label style={campo}>Duración en minutos (opcional)
            <input style={entrada} type="number" min={0} step={1} value={duracion} onChange={(e) => setDuracion(e.target.value)} disabled={ocupado || !escrituraHabilitada} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={final} onChange={(e) => setFinal(e.target.checked)} disabled={ocupado || !escrituraHabilitada} />
            Es solución final
          </label>
          <label style={campo}>Solución aplicada {final ? "(obligatoria)" : "(opcional)"}
            <textarea style={entrada} rows={2} value={solucion} onChange={(e) => setSolucion(e.target.value)} required={final} disabled={ocupado || !escrituraHabilitada} />
          </label>
          <button className="primary" type="submit" disabled={ocupado || !escrituraHabilitada}>
            {ocupado ? "Guardando..." : "Registrar atención"}
          </button>
        </form>
      )}
      {contexto?.puede_cerrar && (
        <form onSubmit={cerrarTicket} style={{ display: "grid", gap: 12, borderTop: "1px solid #e0e7ef", paddingTop: 15 }}>
          <h4 style={{ margin: 0 }}>Cerrar incidencia</h4>
          <p style={{ fontSize: 13, color: "#53657a", margin: 0 }}>Se verificó una solución final del ciclo vigente.</p>
          <label style={campo}>Resumen técnico de cierre (mínimo 20 caracteres)
            <textarea style={entrada} rows={3} maxLength={2000} minLength={20} value={resumenCierre} onChange={(e) => setResumenCierre(e.target.value)} required disabled={ocupado || !escrituraHabilitada} />
          </label>
          <button className="primary" type="submit" disabled={ocupado || !escrituraHabilitada}>
            {ocupado ? "Procesando..." : "Confirmar cierre"}
          </button>
        </form>
      )}
      <button type="button" className="outline" onClick={() => setRecarga((n) => n + 1)} disabled={cargando || ocupado}>
        Actualizar contexto técnico
      </button>
    </section>
  )
}
