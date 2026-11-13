/**
 * Paso 110D1: detalle de incidencias de la API real.
 * Consultas de lectura y formulario opcional de asignacion para JEFE.
 * V3 funciona por defecto. El historial por ciclos V4 solo se consulta si
 * VITE_CONSULTA_CICLOS_V4=true y la migracion V4 fue validada previamente.
 */
import { useEffect, useState, type CSSProperties } from "react"
import { solicitarAPI, type IncidenciaReal, type Rol } from "./api"
import RealAssignment from "./RealAssignment"
import RealTechnicalActions from "./RealTechnicalActions"

type Props = {
  token: string
  ticket: IncidenciaReal
  rol?: Rol
  onVolver: () => void
}

type DetalleIncidencia = IncidenciaReal & {
  reportante_id: string
  descripcion: string
  categoria: string | null
  equipo_sistema_afectado: string | null
  ubicacion: string | null
  impacto: string | null
  fecha_cierre: string | null
  cerrado_por_usuario_id: string | null
}

type Evento = {
  id: string
  accion: string
  descripcion: string
  fecha_registro: string
}

type Intervencion = {
  id: string
  tecnico_id: string
  diagnostico: string
  acciones_realizadas: string
  solucion_aplicada: string | null
  es_solucion_final: boolean
  fecha_registro: string
  ciclo_atencion?: number
}

type Seccion = "resumen" | "atenciones" | "historial"

const usarCiclosV4 = import.meta.env.VITE_CONSULTA_CICLOS_V4 === "true"

const panel: CSSProperties = {
  background: "#fff",
  border: "1px solid #e0e7ef",
  borderRadius: 16,
  padding: 22,
  boxShadow: "0 5px 20px rgba(16, 35, 63, .04)",
}
const etiquetas: CSSProperties = { fontSize: 12, color: "#64748b", margin: "0 0 5px" }
const valores: CSSProperties = { margin: 0, fontWeight: 600, color: "#182b46", overflowWrap: "anywhere" }
const boton: CSSProperties = {
  borderRadius: 9,
  border: "1px solid #d3deea",
  padding: "9px 14px",
  background: "white",
  cursor: "pointer",
  font: "inherit",
}

function fecha(valor: string | null | undefined) {
  if (!valor) return "No registrada"
  const f = new Date(valor)
  return Number.isNaN(f.getTime()) ? "Fecha no disponible" : f.toLocaleString("es-PE")
}

function Campo({ nombre, valor }: { nombre: string; valor: string | null | undefined }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={etiquetas}>{nombre}</p>
      <p style={valores}>{valor?.trim() || "No especificado"}</p>
    </div>
  )
}

export default function RealTicketDetail({ token, ticket, rol, onVolver }: Props) {
  const [detalle, setDetalle] = useState<DetalleIncidencia | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [intervenciones, setIntervenciones] = useState<Intervencion[]>([])
  const [seccion, setSeccion] = useState<Seccion>("resumen")
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [recarga, setRecarga] = useState(0)
  const [mensajeAsignacion, setMensajeAsignacion] = useState("")

  useEffect(() => { setMensajeAsignacion("") }, [ticket.id])

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError("")
    setDetalle(null)
    setEventos([])
    setIntervenciones([])

    const id = encodeURIComponent(ticket.id)
    const rutaIntervenciones = usarCiclosV4
      ? `/api/v4/incidencias/${id}/intervenciones`
      : `/api/incidencias/${id}/intervenciones`

    Promise.all([
      solicitarAPI<DetalleIncidencia>(`/api/incidencias/${id}`, token),
      solicitarAPI<Evento[]>(`/api/incidencias/${id}/historial`, token),
      solicitarAPI<Intervencion[]>(rutaIntervenciones, token),
    ])
      .then(([info, actividad, atenciones]) => {
        if (!vigente) return
        setDetalle(info)
        setEventos(actividad)
        setIntervenciones(atenciones)
      })
      .catch((fallo: unknown) => {
        if (!vigente) return
        setError(fallo instanceof Error ? fallo.message : "No se pudo consultar la incidencia.")
      })
      .finally(() => {
        if (vigente) setCargando(false)
      })

    return () => { vigente = false }
  }, [token, ticket.id, recarga])

  const tabs: { id: Seccion; nombre: string; cantidad?: number }[] = [
    { id: "resumen", nombre: "Resumen" },
    { id: "atenciones", nombre: "Atenciones", cantidad: intervenciones.length },
    { id: "historial", nombre: "Historial", cantidad: eventos.length },
  ]

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <button type="button" onClick={onVolver} style={boton}>← Volver al listado</button>
        <button
          type="button"
          disabled={cargando}
          onClick={() => setRecarga((x) => x + 1)}
          style={{ ...boton, opacity: cargando ? .6 : 1 }}
        >
          {cargando ? "Actualizando..." : "Actualizar detalle"}
        </button>
      </div>

      <header style={{ ...panel, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p style={{ ...etiquetas, fontWeight: 700, letterSpacing: ".08em" }}>{ticket.codigo}</p>
            <h2 style={{ margin: 0, fontSize: "clamp(18px, 3vw, 26px)", color: "#142c4a" }}>
              {detalle?.asunto || ticket.asunto}
            </h2>
          </div>
          <span style={{
            alignSelf: "start", padding: "8px 12px", borderRadius: 999,
            background: ticket.estado === "Cerrado" ? "#e7f7ed" : ticket.estado === "Pendiente" ? "#fff5db" : "#e6f0ff",
            color: ticket.estado === "Cerrado" ? "#177044" : ticket.estado === "Pendiente" ? "#8c5d14" : "#2057a5",
            fontWeight: 700, fontSize: 13,
          }}>
            {detalle?.estado || ticket.estado}
          </span>
        </div>
        <p style={{ color: "#65758b", fontSize: 13, margin: 0 }}>
          Consulta de la incidencia y sus actuaciones. Solo el jefe puede registrar una asignación si el entorno lo autoriza.
        </p>
      </header>

      {mensajeAsignacion && (
        <p role="status" style={{ ...panel, color: "#176a46", fontWeight: 700 }}>
          {mensajeAsignacion}
        </p>
      )}

      {rol === "JEFE" && !cargando && detalle && (
        <RealAssignment
          token={token}
          ticketId={ticket.id}
          onAsignada={() => {
            setMensajeAsignacion("Asignación registrada. Datos de la incidencia actualizados.")
            setRecarga((actual) => actual + 1)
          }}
        />
      )}

      
      {rol &&
        ["JEFE", "ASISTENTE", "PRACTICANTE"].includes(rol) &&
        !cargando &&
        detalle && (
          <RealTechnicalActions
            token={token}
            ticketId={ticket.id}
            onActualizada={() =>
              setRecarga((n) => n + 1)
            }
          />
      )}


      <nav aria-label="Secciones del detalle" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSeccion(tab.id)}
            aria-pressed={seccion === tab.id}
            style={{
              ...boton,
              borderColor: seccion === tab.id ? "#285da8" : "#d3deea",
              background: seccion === tab.id ? "#eaf2fd" : "#fff",
              color: seccion === tab.id ? "#1b4c92" : "#34445a",
              fontWeight: seccion === tab.id ? 700 : 500,
            }}
          >
            {tab.nombre}{tab.cantidad !== undefined ? ` (${tab.cantidad})` : ""}
          </button>
        ))}
      </nav>

      {error && (
        <div role="alert" style={{ ...panel, borderColor: "#f4b8b8", background: "#fff7f7", color: "#a32626" }}>
          {error} {usarCiclosV4 && "Si la migración V4 no está habilitada, desactiva VITE_CONSULTA_CICLOS_V4."}
        </div>
      )}
      {cargando && <div style={panel} role="status">Consultando información de la incidencia...</div>}

      {!cargando && detalle && seccion === "resumen" && (
        <section style={{ ...panel, display: "grid", gap: 22 }}>
          <h3 style={{ margin: 0, color: "#182b46" }}>Información de la incidencia</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 20 }}>
            <Campo nombre="Código" valor={detalle.codigo} />
            <Campo nombre="Categoría" valor={detalle.categoria} />
            <Campo nombre="Prioridad" valor={detalle.prioridad} />
            <Campo nombre="Equipo o sistema" valor={detalle.equipo_sistema_afectado} />
            <Campo nombre="Ubicación" valor={detalle.ubicacion} />
            <Campo nombre="Impacto" valor={detalle.impacto} />
            <Campo nombre="Fecha de registro" valor={fecha(detalle.fecha_registro)} />
            <Campo nombre="Fecha de cierre" valor={fecha(detalle.fecha_cierre)} />
          </div>
          <div>
            <p style={etiquetas}>Descripción del problema</p>
            <p style={{ ...valores, whiteSpace: "pre-wrap", fontWeight: 400 }}>{detalle.descripcion}</p>
          </div>
        </section>
      )}

      {!cargando && detalle && seccion === "atenciones" && (
        <section style={{ display: "grid", gap: 12 }}>
          {intervenciones.length === 0 && <div style={panel}>Todavía no hay atenciones técnicas registradas.</div>}
          {intervenciones.map((item) => (
            <article key={item.id} style={{ ...panel, display: "grid", gap: 12 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ color: "#182b46" }}>Atención técnica{item.ciclo_atencion ? ` · Ciclo ${item.ciclo_atencion}` : ""}</strong>
                <span style={{ fontSize: 12, color: "#64748b" }}>{fecha(item.fecha_registro)}</span>
              </div>
              <Campo nombre="Diagnóstico" valor={item.diagnostico} />
              <Campo nombre="Acciones realizadas" valor={item.acciones_realizadas} />
              <Campo nombre="Solución aplicada" valor={item.solucion_aplicada} />
              <span style={{ color: item.es_solucion_final ? "#177044" : "#8c5d14", fontSize: 12, fontWeight: 700 }}>
                {item.es_solucion_final ? "Solución final" : "Atención preliminar"}
              </span>
            </article>
          ))}
        </section>
      )}

      {!cargando && detalle && seccion === "historial" && (
        <section style={{ display: "grid", gap: 12 }}>
          {eventos.length === 0 && <div style={panel}>Todavía no hay eventos en el historial.</div>}
          {eventos.map((evento) => (
            <article key={evento.id} style={{ ...panel, display: "grid", gap: 7 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ color: "#182b46" }}>{evento.accion}</strong>
                <span style={{ fontSize: 12, color: "#64748b" }}>{fecha(evento.fecha_registro)}</span>
              </div>
              <p style={{ margin: 0, color: "#405168", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {evento.descripcion}
              </p>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
