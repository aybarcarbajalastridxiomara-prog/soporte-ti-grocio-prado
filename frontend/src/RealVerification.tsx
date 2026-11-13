/** Paso 110D4: conformidad u observacion, con reapertura por V4.
 * Solo se presenta al REPRESENTANTE. Ningun POST automatico.
 */
import { useEffect, useState, type CSSProperties, type FormEvent } from "react"
import { solicitarAPI } from "./api"

type Evaluacion = {
  id: string
  resultado: "Conformidad" | "Observación"
  observaciones: string | null
  fecha_verificacion: string
}

type Contexto = {
  incidencia_id: string
  codigo: string
  estado: string
  esquema_v4: boolean
  ciclo_actual: number
  fecha_cierre: string | null
  evaluacion_actual: Evaluacion | null
  puede_verificar: boolean
  ruta_verificacion: string
}

type Resultado = "" | "Conformidad" | "Observación"
type Props = { token: string; ticketId: string; onActualizada: () => void }

// No habilitar la escritura en Vercel/produccion hasta autorizar pruebas.
const escrituraHabilitada =
  import.meta.env.VITE_PERMITIR_VERIFICACION_REAL === "true"

const panel: CSSProperties = {
  background: "#fff", border: "1px solid #dbe5ef",
  borderRadius: 16, padding: 22, display: "grid", gap: 14,
}
const campo: CSSProperties = {
  display: "grid", gap: 7, fontSize: 13, fontWeight: 650, color: "#324965",
}
const entrada: CSSProperties = {
  width: "100%", padding: 11, border: "1px solid #d1deeb",
  borderRadius: 9, font: "inherit", boxSizing: "border-box",
}
const errorTexto = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la operación."

export default function RealVerification({ token, ticketId, onActualizada }: Props) {
  const [contexto, setContexto] = useState<Contexto | null>(null)
  const [resultado, setResultado] = useState<Resultado>("")
  const [observaciones, setObservaciones] = useState("")
  const [confirmado, setConfirmado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [exito, setExito] = useState("")
  const [recarga, setRecarga] = useState(0)

  const id = encodeURIComponent(ticketId)
  const rutaContexto = `/api/incidencias/${id}/contexto-verificacion`

  useEffect(() => {
    let activo = true
    setCargando(true)
    setContexto(null)
    setError("")
    solicitarAPI<Contexto>(rutaContexto, token)
      .then((datos) => { if (activo) setContexto(datos) })
      .catch((fallo: unknown) => { if (activo) setError(errorTexto(fallo)) })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [rutaContexto, token, recarga])

  useEffect(() => {
    setResultado("")
    setObservaciones("")
    setConfirmado(false)
    setExito("")
  }, [ticketId])

  async function registrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando || cargando || !escrituraHabilitada || !contexto) return
    if (resultado !== "Conformidad" && resultado !== "Observación") {
      setError("Selecciona conformidad u observación.")
      return
    }
    if (resultado === "Observación" && observaciones.trim().length < 5) {
      setError("Describe la observación (mínimo 5 caracteres).")
      return
    }
    if (observaciones.trim().length > 2000) {
      setError("El comentario no debe exceder 2000 caracteres.")
      return
    }
    if (!confirmado) {
      setError("Confirma que has revisado el cierre antes de registrar tu respuesta.")
      return
    }
    setGuardando(true)
    setError("")
    setExito("")
    try {
      // Revalidar la informacion justo antes de registrar la respuesta.
      const vigente = await solicitarAPI<Contexto>(rutaContexto, token)
      const prefijo = vigente.esquema_v4 ? "/api/v4/incidencias" : "/api/incidencias"
      const rutaEsperada = `${prefijo}/${id}/verificaciones`
      if (!vigente.puede_verificar || vigente.evaluacion_actual ||
          vigente.estado !== "Cerrado" ||
          vigente.ciclo_actual !== contexto.ciclo_actual ||
          vigente.esquema_v4 !== contexto.esquema_v4 ||
          vigente.ruta_verificacion !== rutaEsperada) {
        throw new Error("La incidencia cambió o ya fue evaluada. Actualiza antes de continuar.")
      }
      await solicitarAPI<unknown>(rutaEsperada, token, {
        method: "POST",
        body: JSON.stringify({
          resultado,
          observaciones: observaciones.trim() || null,
        }),
      })
      setExito(resultado === "Observación"
        ? vigente.esquema_v4
          ? "Observación registrada. El ticket fue reabierto para un nuevo ciclo."
          : "Observación registrada. La reapertura automática requiere V4."
        : "Conformidad registrada correctamente.")
      setResultado("")
      setObservaciones("")
      setConfirmado(false)
      setRecarga((n) => n + 1)
      onActualizada()
    } catch (fallo) {
      setError(errorTexto(fallo))
      setRecarga((n) => n + 1)
    } finally {
      setGuardando(false)
    }
  }

  const disponible = Boolean(contexto?.puede_verificar) && !contexto?.evaluacion_actual
  const puedeEnviar = escrituraHabilitada && disponible && !cargando && !guardando &&
    confirmado && (resultado === "Conformidad" ||
      (resultado === "Observación" && observaciones.trim().length >= 5))

  return (
    <section style={panel} aria-label="Conformidad y observaciones">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h3 style={{ margin: "0 0 5px", color: "#183958" }}>Verificación del área solicitante</h3>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            Registra tu conformidad o una observación de la atención técnica.
          </p>
        </div>
        {contexto && (
          <strong style={{ color: "#245897", fontSize: 12 }}>
            Ciclo {contexto.ciclo_actual} · {contexto.esquema_v4 ? "Esquema V4" : "Esquema V3"}
          </strong>
        )}
      </div>
      {cargando && <p role="status">Consultando cierre y evaluaciones...</p>}
      {error && <p role="alert" style={{ color: "#b42332", margin: 0 }}>{error}</p>}
      {exito && <p role="status" style={{ color: "#177044", margin: 0, fontWeight: 600 }}>{exito}</p>}
      {!escrituraHabilitada && (
        <p style={{ margin: 0, color: "#80631d", fontSize: 13 }}>
          Registro deshabilitado hasta autorizar pruebas en un entorno seguro.
        </p>
      )}
      {contexto?.evaluacion_actual && (
        <div style={{ background: "#f1f7fc", padding: 14, borderRadius: 10 }}>
          <strong>Este ciclo ya tiene una evaluación: {contexto.evaluacion_actual.resultado}</strong>
          <p style={{ margin: "5px 0 0" }}>
            {contexto.evaluacion_actual.observaciones || "Sin observaciones adicionales."}
          </p>
        </div>
      )}
      {contexto && !contexto.puede_verificar && !contexto.evaluacion_actual && (
        <p style={{ margin: 0, color: "#617086" }}>
          El ticket está en estado «{contexto.estado}». Solo puedes evaluar un cierre técnico finalizado.
        </p>
      )}
      {contexto && disponible && (
        <form onSubmit={registrar} style={{ display: "grid", gap: 13 }}>
          <label style={campo}>
            Resultado de la revisión
            <select
              style={entrada}
              value={resultado}
              onChange={(e) => {
                setResultado(e.target.value as Resultado)
                setConfirmado(false)
              }}
              disabled={guardando || !escrituraHabilitada}
              required
            >
              <option value="">Selecciona una opción</option>
              <option value="Conformidad">Conformidad — la atención resolvió el problema</option>
              <option value="Observación">Observación — el problema persiste</option>
            </select>
          </label>
          <label style={campo}>
            {resultado === "Observación" ? "Detalle de la observación *" : "Comentarios (opcional)"}
            <textarea
              style={{ ...entrada, minHeight: 96, resize: "vertical" }}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              disabled={guardando || !escrituraHabilitada}
              maxLength={2000}
              placeholder={resultado === "Observación"
                ? "Explica qué falla persiste después de la intervención..."
                : "Comentarios acerca de la solución aplicada..."}
              required={resultado === "Observación"}
            />
          </label>
          {resultado === "Observación" && (
            <p style={{ margin: 0, color: "#98551e", fontSize: 13 }}>
              {contexto.esquema_v4
                ? "Al enviar, se reabrirá este ticket en un nuevo ciclo y requerirá nueva asignación."
                : "Esta base todavía utiliza V3: se registrará la observación, pero no habrá reapertura automática."}
            </p>
          )}
          <label style={{ display: "flex", alignItems: "start", gap: 9, fontSize: 13, color: "#344860" }}>
            <input
              type="checkbox"
              checked={confirmado}
              onChange={(e) => setConfirmado(e.target.checked)}
              disabled={guardando || !escrituraHabilitada}
            />
            Confirmo que revisé la atención y deseo registrar esta evaluación.
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="submit" className="primary" disabled={!puedeEnviar}>
              {guardando ? "Registrando..." : "Registrar evaluación"}
            </button>
            <button type="button" className="outline" disabled={guardando}
              onClick={() => setRecarga((n) => n + 1)}>
              Actualizar estado
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
