/**
 * Paso 110D2B - Formulario de asignacion para el JEFE.
 * Solo se monta desde el detalle del usuario autorizado.
 * No se ejecutan escrituras automaticas y la accion requiere habilitacion
 * explicita del entorno y una pulsacion del usuario.
 */
import { useEffect, useState, type ChangeEvent, type CSSProperties, type FormEvent } from "react"
import { solicitarAPI } from "./api"

type Tecnico = {
  id: string
  nombre_completo: string
  usuario: string
  rol: "ASISTENTE" | "PRACTICANTE"
}

type ContextoAsignacion = {
  incidencia_id: string
  codigo: string
  estado: string
  esquema_v4: boolean
  ciclo_actual: number
  tecnico_activo: {
    id: string
    nombre_completo: string
    rol: string
    fecha_asignacion: string
  } | null
  puede_asignar: boolean
  ruta_asignacion: string
}

type RespuestaAsignacion = {
  asignacion_id: string
  incidencia_id: string
  tecnico_id: string
  estado: string
  ciclo_atencion?: number
}

type Props = {
  token: string
  ticketId: string
  onAsignada: () => void
}

const escrituraHabilitada =
  import.meta.env.VITE_PERMITIR_ASIGNACION_REAL === "true"

const panel: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe5f0",
  borderRadius: 16,
  boxShadow: "0 5px 18px rgba(22, 45, 72, .04)",
  padding: 22,
}

const boton: CSSProperties = {
  border: "1px solid #d6e0eb",
  borderRadius: 10,
  padding: "10px 14px",
  font: "inherit",
  fontWeight: 600,
  background: "#ffffff",
  cursor: "pointer",
}

const mensajeError = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la operación."

export default function RealAssignment({ token, ticketId, onAsignada }: Props) {
  const [contexto, setContexto] = useState<ContextoAsignacion | null>(null)
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [seleccion, setSeleccion] = useState("")
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [mensaje, setMensaje] = useState("")
  const [recarga, setRecarga] = useState(0)

  const identificador = encodeURIComponent(ticketId)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError("")
    setMensaje("")
    setSeleccion("")
    setContexto(null)
    setTecnicos([])

    Promise.all([
      solicitarAPI<ContextoAsignacion>(
        `/api/incidencias/${encodeURIComponent(ticketId)}/contexto-asignacion`,
        token,
      ),
      solicitarAPI<Tecnico[]>("/api/tecnicos", token),
    ])
      .then(([datos, lista]) => {
        if (!vigente) return
        setContexto(datos)
        setTecnicos(lista)
      })
      .catch((fallo: unknown) => {
        if (!vigente) return
        setContexto(null)
        setTecnicos([])
        setError(mensajeError(fallo))
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => { vigente = false }
  }, [ticketId, token, recarga])

  async function asignar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (cargando || guardando || !escrituraHabilitada || !contexto) return

    if (!contexto.puede_asignar || contexto.tecnico_activo) {
      setError("Esta incidencia no permite otra asignación. Actualiza su estado.")
      return
    }
    if (!tecnicos.some((tecnico) => tecnico.id === seleccion)) {
      setError("Selecciona un técnico habilitado de la lista.")
      return
    }

    setGuardando(true)
    setError("")
    setMensaje("")

    try {
      // Reconsultar evita operar con una pantalla obsoleta.
      // El backend vuelve a validar estado, ciclo, rol y conflictos.
      const vigente = await solicitarAPI<ContextoAsignacion>(
        `/api/incidencias/${identificador}/contexto-asignacion`,
        token,
      )
      if (
        !vigente.puede_asignar ||
        vigente.tecnico_activo ||
        vigente.ciclo_actual !== contexto.ciclo_actual ||
        vigente.ruta_asignacion !== contexto.ruta_asignacion
      ) {
        throw new Error("La incidencia cambió. Actualízala antes de asignar.")
      }

      const rutaEsperada = vigente.ciclo_actual > 1
        ? `/api/v4/incidencias/${identificador}/asignar`
        : `/api/asignaciones/${identificador}/asignar`

      if (vigente.ruta_asignacion !== rutaEsperada) {
        throw new Error("La ruta de asignación no coincide con el ciclo actual.")
      }

      const resultado = await solicitarAPI<RespuestaAsignacion>(
        rutaEsperada,
        token,
        {
          method: "POST",
          body: JSON.stringify({ tecnico_id: seleccion }),
        },
      )

      const nombre = tecnicos.find((tecnico) => tecnico.id === resultado.tecnico_id)
        ?.nombre_completo || "Técnico seleccionado"

      setSeleccion("")
      setMensaje(`Asignación registrada correctamente a ${nombre}.`)
      setRecarga((actual) => actual + 1)
      onAsignada()
    } catch (fallo) {
      setError(mensajeError(fallo))
      // Una validacion/POST fallidos no deben dejar una pantalla obsoleta.
      setRecarga((actual) => actual + 1)
    } finally {
      setGuardando(false)
    }
  }

  const disponible = Boolean(contexto?.puede_asignar) && !contexto?.tecnico_activo
  const permitirEnviar =
    escrituraHabilitada && disponible && !cargando && !guardando && Boolean(seleccion)

  return (
    <section style={{ ...panel, display: "grid", gap: 14 }} aria-label="Asignación de técnico">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h3 style={{ margin: "0 0 5px", fontSize: 19, color: "#183453" }}>
            Asignación de responsable
          </h3>
          <p style={{ margin: 0, color: "#5e7086", fontSize: 13 }}>
            Disponible exclusivamente para el Jefe de Sistemas.
          </p>
        </div>
        {contexto && (
          <span style={{ borderRadius: 999, padding: "7px 12px", fontWeight: 700, fontSize: 12, background: "#eaf2fd", color: "#25568f" }}>
            Ciclo {contexto.ciclo_actual} · {contexto.ciclo_actual > 1 ? "Reapertura V4" : "Atención inicial V3"}
          </span>
        )}
      </div>

      {cargando ? <p role="status" style={{ margin: 0 }}>Consultando técnicos y responsable...</p> : null}
      {error ? <p role="alert" style={{ margin: 0, color: "#a32929" }}>{error}</p> : null}
      {mensaje ? <p role="status" style={{ margin: 0, color: "#176a46", fontWeight: 600 }}>{mensaje}</p> : null}

      {!cargando && contexto?.tecnico_activo ? (
        <div style={{ background: "#f1f7fc", borderRadius: 11, padding: 15 }}>
          <strong style={{ color: "#213f62" }}>Responsable actual</strong>
          <p style={{ margin: "5px 0 0", color: "#344a65" }}>
            {contexto.tecnico_activo.nombre_completo} · {contexto.tecnico_activo.rol}
          </p>
          <small style={{ color: "#5e7086" }}>
            Ya existe una asignación activa. No se permiten duplicados.
          </small>
        </div>
      ) : null}

      {!cargando && contexto && !contexto.puede_asignar && !contexto.tecnico_activo ? (
        <p style={{ margin: 0, color: "#695d42" }}>
          La incidencia está en estado {contexto.estado} y no admite una nueva asignación en este momento.
        </p>
      ) : null}

      {!cargando && contexto && disponible ? (
        <form onSubmit={asignar} style={{ display: "grid", gap: 12 }}>
          <label htmlFor="tecnico-asignacion" style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 700, color: "#334860" }}>
            Seleccionar técnico habilitado
            <select
              id="tecnico-asignacion"
              value={seleccion}
              onChange={(evento: ChangeEvent<HTMLSelectElement>) => setSeleccion(evento.target.value)}
              disabled={guardando || !escrituraHabilitada}
              required
              style={{ ...boton, width: "100%", minHeight: 44, fontWeight: 500, color: "#173555" }}
            >
              <option value="">Seleccionar asistente o practicante</option>
              {tecnicos.map((tecnico) => (
                <option key={tecnico.id} value={tecnico.id}>
                  {tecnico.nombre_completo} · {tecnico.rol}
                </option>
              ))}
            </select>
          </label>

          {tecnicos.length === 0 ? (
            <p style={{ margin: 0, color: "#a32929", fontSize: 13 }}>
              No hay asistentes ni practicantes habilitados para asignar.
            </p>
          ) : null}

          {!escrituraHabilitada ? (
            <p style={{ margin: 0, color: "#796026", fontSize: 13 }}>
              Registro de asignaciones deshabilitado en este entorno hasta autorizar pruebas.
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="submit"
              className="primary"
              disabled={!permitirEnviar}
            >
              {guardando ? "Registrando asignación..." : "Asignar responsable"}
            </button>
            <button
              type="button"
              style={{ ...boton, opacity: guardando ? .6 : 1 }}
              disabled={guardando || cargando}
              onClick={() => { setMensaje(""); setRecarga((actual) => actual + 1) }}
            >
              Actualizar disponibilidad
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
