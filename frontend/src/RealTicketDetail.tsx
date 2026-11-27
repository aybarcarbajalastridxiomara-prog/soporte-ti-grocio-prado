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
import RealVerification from "./RealVerification"
import RealTake from "./RealTake"
import RealPriority from "./RealPriority"
import RealTechnicalReport from "./RealTechnicalReport"
import RealAttachments from "./RealAttachments"
import { descripcionPrioridad } from "./tiOperations"
import { Badge, Icon } from "./RealUI"

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
  fecha_inicio_problema: string | null
  hora_inicio_problema: string | null
  incidencia_anterior_id: string | null
  detalle_reincidencia: string | null
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

type Seccion = "resumen" | "atenciones" | "historial" | "informe"

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

function fecha(valor: string | null | undefined) {
  if (!valor) return "No registrada"
  const f = new Date(valor)
  return Number.isNaN(f.getTime()) ? "Fecha no disponible" : f.toLocaleString("es-PE", { timeZone: "America/Lima" })
}

function Campo({ nombre, valor, icono }: { nombre: string; valor: string | null | undefined; icono?: string }) {
  return (
    <div className="incident-detail-field">
      {icono && <Icon name={icono} />}
      <div><p style={etiquetas}>{nombre}</p>
      <p style={valores}>{valor?.trim() || "No especificado"}</p></div>
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

  const tabs: { id: Seccion; nombre: string; icono: string; cantidad?: number }[] = [
    { id: "resumen", nombre: "Resumen", icono: "clipboard" },
    { id: "atenciones", nombre: "Atenciones", icono: "login-headset", cantidad: intervenciones.length },
    { id: "historial", nombre: "Historial", icono: "clock", cantidad: eventos.length },
    ...(rol && ["JEFE", "ASISTENTE", "PRACTICANTE"].includes(rol) ? [{ id: "informe" as const, nombre: "Informe técnico", icono: "reports" }] : []),
  ]

  return (
    <div className="real-detail incident-detail">
      <header className="card incident-detail-header">
        <div className="incident-detail-nav"><button type="button" className="text-button" onClick={onVolver}>‹ Volver al listado</button>
          <button type="button" className="outline" disabled={cargando} onClick={() => setRecarga(x => x + 1)}><Icon name="refresh" />{cargando ? "Actualizando…" : "Actualizar detalle"}</button></div>
        <div className="incident-detail-title">
          <span className="incident-detail-icon"><Icon name="clipboard" /></span>
          <div><span className="incident-count">{ticket.codigo}</span><h2>{detalle?.asunto || ticket.asunto}</h2><p>Consulta de la incidencia y sus actuaciones.</p></div>
          <Badge>{detalle?.estado || ticket.estado}</Badge>
        </div>
      </header>
      <div className="card incident-detail-metadata">
        <Campo icono="users" nombre="Área municipal" valor={detalle?.area_nombre || ticket.area_nombre} />
        <Campo icono="login-monitor" nombre="Categoría" valor={detalle?.categoria} />
        <Campo icono="reports" nombre="Prioridad" valor={detalle?.prioridad || ticket.prioridad} />
        <Campo icono="clock" nombre="Registrada" valor={fecha(detalle?.fecha_registro || ticket.fecha_registro)} />
      </div>

      {mensajeAsignacion && (
        <p role="status" style={{ ...panel, color: "#176a46", fontWeight: 700 }}>
          {mensajeAsignacion}
        </p>
      )}

      {rol && !cargando && detalle && <RealPriority token={token} ticketId={ticket.id} rol={rol} onActualizada={() => setRecarga(n => n + 1)} />}
      {rol && ["JEFE", "ASISTENTE", "PRACTICANTE"].includes(rol) && !cargando && detalle && detalle.estado !== "Cerrado" &&
        <RealTake token={token} ticketId={ticket.id} onActualizada={() => setRecarga(n => n + 1)} />}
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

      
     {rol === "REPRESENTANTE" && !cargando && detalle && (
       <RealVerification
         token={token}
         ticketId={ticket.id}
         onActualizada={() => setRecarga((n) => n + 1)}
       />
     )}
   


      <nav aria-label="Secciones del detalle" className="incident-detail-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSeccion(tab.id)}
            aria-pressed={seccion === tab.id}
          >
            <Icon name={tab.icono} />{tab.nombre}{tab.cantidad !== undefined ? ` (${tab.cantidad})` : ""}
          </button>
        ))}
      </nav>

      {error && (
        <div role="alert" style={{ ...panel, borderColor: "#f4b8b8", background: "#fff7f7", color: "#a32626" }}>
          {error}
        </div>
      )}
      {cargando && <div style={panel} role="status">Consultando información de la incidencia...</div>}
      {!cargando && detalle && seccion === "informe" && rol && ["JEFE", "ASISTENTE", "PRACTICANTE"].includes(rol) && <RealTechnicalReport token={token} ticketId={ticket.id} />}

      {!cargando && detalle && seccion === "resumen" && (
        <section className="card incident-detail-overview">
          <h3><Icon name="clipboard" />Información de la incidencia</h3>
          <div className="incident-detail-fields">
            <Campo nombre="Código" valor={detalle.codigo} />
            <Campo nombre="Categoría" valor={detalle.categoria} />
            <Campo nombre="Prioridad" valor={detalle.prioridad} />
            <Campo nombre="Equipo o sistema" valor={detalle.equipo_sistema_afectado} />
            <Campo nombre="Ubicación" valor={detalle.ubicacion} />
            <Campo nombre="Impacto" valor={detalle.impacto} />
            <Campo nombre="Área municipal" valor={detalle.area_nombre || ticket.area_nombre} />
            <Campo nombre="Inicio del problema" valor={detalle.fecha_inicio_problema} />
            <Campo nombre="Hora aproximada" valor={detalle.hora_inicio_problema} />
            <Campo nombre="Fecha de registro" valor={fecha(detalle.fecha_registro)} />
            <Campo nombre="Fecha de cierre" valor={fecha(detalle.fecha_cierre)} />
          </div>
          <div>
            <p style={etiquetas}>Descripción del problema</p>
            <p className="incident-detail-description">{detalle.descripcion}</p>
            {detalle.incidencia_anterior_id && <div className="notice"><b>Antecedente vinculado</b><p>Referencia: {detalle.incidencia_anterior_id}</p><p>{detalle.detalle_reincidencia || "Sin observaciones adicionales."}</p></div>}
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

      {!cargando && detalle && seccion === "resumen" && <RealAttachments token={token} ticketId={ticket.id} />}

      {!cargando && detalle && seccion === "historial" && (
        <section style={{ display: "grid", gap: 12 }}>
          {eventos.length === 0 && <div style={panel}>Todavía no hay eventos en el historial.</div>}
          {eventos.map((evento) => (
            <article key={evento.id} style={{ ...panel, display: "grid", gap: 7 }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ color: "#182b46" }}>{evento.accion === "CIERRE_PRESERVADO" ? "Cierre anterior conservado" : evento.accion}</strong>
                <span style={{ fontSize: 12, color: "#64748b" }}>{fecha(evento.fecha_registro)}</span>
              </div>
              <p style={{ margin: 0, color: "#405168", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {descripcionPrioridad(evento.accion, evento.descripcion)}
              </p>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
