
import { useState, type FormEvent } from "react"
import { registrarIncidenciaReal } from "./api"

type Props = {
  token: string
  onCancelar: () => void
  onCreada: (codigo: string) => Promise<void>
}

type Impacto = "" | "Si" | "Parcialmente" | "No"

const campo = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
} as const

const opcional = (valor: string) =>
  valor.trim() || null

export default function RealRegister({
  token,
  onCancelar,
  onCreada,
}: Props) {
  const [asunto, setAsunto] = useState("")
  const [descripcion, setDescripcion] = useState("")
  const [categoria, setCategoria] = useState("")
  const [equipo, setEquipo] = useState("")
  const [ubicacion, setUbicacion] = useState("")
  const [impacto, setImpacto] = useState<Impacto>("")

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (guardando) return

    if (!asunto.trim() || !descripcion.trim()) {
      setError("El asunto y la descripción son obligatorios.")
      return
    }

    setGuardando(true)
    setError("")

    try {
      const incidencia = await registrarIncidenciaReal(
        token,
        {
          asunto: asunto.trim(),
          descripcion: descripcion.trim(),
          categoria: opcional(categoria),
          equipo_sistema_afectado: opcional(equipo),
          ubicacion: opcional(ubicacion),
          impacto: impacto || null,
        },
      )

      await onCreada(incidencia.codigo)
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No se pudo registrar la incidencia.",
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #e1e7ee",
        borderRadius: 12,
        padding: 24,
        maxWidth: 850,
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 8px" }}>
          Registrar nueva incidencia
        </h2>
        <p style={{ color: "#65758b", margin: 0 }}>
          Describe el problema tecnológico para solicitar
          atención de la Unidad de Sistemas.
        </p>
      </div>

      <form onSubmit={guardar}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 18,
          }}
        >
          <label style={campo}>
            Asunto *
            <input
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              maxLength={200}
              placeholder="Ej.: Impresora no funciona"
              required
              disabled={guardando}
            />
          </label>

          <label style={campo}>
            Categoría
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              disabled={guardando}
            >
              <option value="">Seleccionar categoría</option>
              <option value="Hardware">Hardware</option>
              <option value="Software">Software</option>
              <option value="Redes">Redes</option>
              <option value="Equipos periféricos">
                Equipos periféricos
              </option>
              <option value="Accesos y cuentas">
                Accesos y cuentas
              </option>
              <option value="Otros">Otros</option>
            </select>
          </label>

          <label style={campo}>
            Equipo o sistema afectado
            <input
              value={equipo}
              onChange={(e) => setEquipo(e.target.value)}
              maxLength={150}
              placeholder="Ej.: Impresora de Tesorería"
              disabled={guardando}
            />
          </label>

          <label style={campo}>
            Ubicación
            <input
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              maxLength={150}
              placeholder="Ej.: Oficina de Tesorería"
              disabled={guardando}
            />
          </label>

          <label style={campo}>
            Impacto en el trabajo
            <select
              value={impacto}
              onChange={(e) =>
                setImpacto(e.target.value as Impacto)
              }
              disabled={guardando}
            >
              <option value="">No especificado</option>
              <option value="Si">Sí, impide trabajar</option>
              <option value="Parcialmente">
                Afecta parcialmente
              </option>
              <option value="No">
                No impide trabajar
              </option>
            </select>
          </label>
        </div>

        <label
          style={{ ...campo, marginTop: 20 }}
        >
          Descripción detallada del problema *
          <textarea
            value={descripcion}
            onChange={(e) =>
              setDescripcion(e.target.value)
            }
            rows={5}
            placeholder="Explica qué sucede, desde cuándo y cómo afecta el trabajo."
            required
            disabled={guardando}
            style={{
              width: "100%",
              border: "1px solid #d6e0e8",
              borderRadius: 8,
              padding: 12,
              font: "inherit",
              resize: "vertical",
            }}
          />
        </label>

        <p style={{ color: "#65758b", fontSize: 12 }}>
          El sistema generará automáticamente el código,
          el área solicitante y el estado Pendiente.
        </p>

        {error && (
          <div
            className="auth-error"
            role="alert"
            style={{ marginBottom: 16 }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            className="outline"
            onClick={onCancelar}
            disabled={guardando}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="primary"
            disabled={guardando}
          >
            {guardando
              ? "Registrando incidencia..."
              : "Registrar incidencia"}
          </button>
        </div>
      </form>
    </section>
  )
}
