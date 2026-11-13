
import { useState, type FormEvent } from "react"

import {
  iniciarSesionReal,
  consultarPerfilReal,
  listarIncidenciasReales,
  type PerfilReal,
  type IncidenciaReal,
  type SesionReal,
} from "./api"

import RealRegister from "./RealRegister"
import RealTicketDetail from "./RealTicketDetail"

export default function RealApp() {
  // Credenciales
  const [correo, setCorreo] = useState("")
  const [contrasena, setContrasena] = useState("")
  const [mostrarClave, setMostrarClave] = useState(false)

  // Sesion y datos reales
  const [sesion, setSesion] = useState<SesionReal | null>(null)
  const [perfil, setPerfil] = useState<PerfilReal | null>(null)
  const [incidencias, setIncidencias] = useState<IncidenciaReal[]>([])

  // Estado de la interfaz
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState("")

  const [vista, setVista] =
    useState<"lista" | "registro">("lista")

  // PASO 110D1 - Incidencia seleccionada
  const [ticketSeleccionado, setTicketSeleccionado] =
    useState<IncidenciaReal | null>(null)

  // -------------------------------------------------
  // INICIAR SESION
  // -------------------------------------------------

  async function ingresar(
    evento: FormEvent<HTMLFormElement>,
  ) {
    evento.preventDefault()

    if (cargando) return

    setCargando(true)
    setMensaje("")

    try {
      const nuevaSesion = await iniciarSesionReal(
        correo,
        contrasena,
      )

      const perfilAutorizado = await consultarPerfilReal(
        nuevaSesion.access_token,
      )

      if (!perfilAutorizado.habilitado) {
        throw new Error(
          "Tu usuario no está habilitado.",
        )
      }

      const registros = await listarIncidenciasReales(
        nuevaSesion.access_token,
      )

      setSesion(nuevaSesion)
      setPerfil(perfilAutorizado)
      setIncidencias(registros)

      setContrasena("")
      setVista("lista")
      setTicketSeleccionado(null)
    } catch (error) {
      setSesion(null)
      setPerfil(null)
      setIncidencias([])
      setTicketSeleccionado(null)

      setMensaje(
        error instanceof Error
          ? error.message
          : "No fue posible iniciar sesión.",
      )
    } finally {
      setCargando(false)
    }
  }

  // -------------------------------------------------
  // ACTUALIZAR INCIDENCIAS
  // -------------------------------------------------

  async function actualizarIncidencias() {
    if (!sesion || cargando) return

    setCargando(true)
    setMensaje("")

    try {
      const registros = await listarIncidenciasReales(
        sesion.access_token,
      )

      setIncidencias(registros)
    } catch (error) {
      setMensaje(
        error instanceof Error
          ? error.message
          : "No se pudieron actualizar las incidencias.",
      )
    } finally {
      setCargando(false)
    }
  }

  // -------------------------------------------------
  // NAVEGACION
  // -------------------------------------------------

  function mostrarListado() {
    setVista("lista")
    setTicketSeleccionado(null)
    setMensaje("")
  }

  function mostrarRegistro() {
    setVista("registro")
    setTicketSeleccionado(null)
    setMensaje("")
  }

  function abrirDetalle(ticket: IncidenciaReal) {
    setTicketSeleccionado(ticket)
    setVista("lista")
    setMensaje("")
  }

  // -------------------------------------------------
  // CERRAR SESION
  // -------------------------------------------------

  function cerrarSesion() {
    setSesion(null)
    setPerfil(null)
    setIncidencias([])
    setTicketSeleccionado(null)

    setContrasena("")
    setCorreo("")
    setMensaje("")
    setVista("lista")
    setMostrarClave(false)
  }

  // -------------------------------------------------
  // PANTALLA DE INICIO DE SESION
  // -------------------------------------------------

  if (!sesion || !perfil) {
    return (
      <main className="login-screen">
        <section className="login-panel">
          <div className="login-brand">
            <div className="crest large">
              TI
            </div>

            <div>
              <p>
                Municipalidad Distrital de Grocio Prado
              </p>
              <h1>Soporte TI</h1>
            </div>
          </div>

          <div className="login-copy">
            <h2>Bienvenido</h2>

            <p>
              Inicia sesión con tu cuenta institucional
              autorizada para acceder al sistema.
            </p>
          </div>

          <form onSubmit={ingresar}>
            <label>
              Correo electrónico

              <input
                type="email"
                value={correo}
                onChange={(e) =>
                  setCorreo(e.target.value)
                }
                placeholder="correo@institucion.pe"
                autoComplete="username"
                required
              />
            </label>

            <label>
              Contraseña

              <div className="password-field">
                <input
                  type={
                    mostrarClave
                      ? "text"
                      : "password"
                  }
                  value={contrasena}
                  onChange={(e) =>
                    setContrasena(e.target.value)
                  }
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setMostrarClave(!mostrarClave)
                  }
                >
                  {mostrarClave
                    ? "Ocultar"
                    : "Mostrar"}
                </button>
              </div>
            </label>

            {mensaje && (
              <div
                className="auth-error"
                role="alert"
              >
                {mensaje}
              </div>
            )}

            <button
              type="submit"
              className="primary login-submit"
              disabled={cargando}
            >
              {cargando
                ? "Verificando acceso..."
                : "Iniciar sesión"}
            </button>
          </form>

          <p className="login-foot">
            Acceso real mediante Supabase Auth.
            Solo usuarios autorizados.
          </p>
        </section>
      </main>
    )
  }

  // -------------------------------------------------
  // PANEL PRINCIPAL
  // -------------------------------------------------

  return (
    <main className="app-shell">
      {/* MENU LATERAL */}

      <aside className="sidebar">
        <div className="brand">
          <div className="crest">
            TI
          </div>

          <div>
            <strong>Soporte TI</strong>
            <span>Grocio Prado</span>
          </div>
        </div>

        <div className="prototype">
          INTEGRACIÓN REAL · ETAPA DE PRUEBAS
        </div>

        <div className="sidebar-bottom">
          <div className="profile-mini">
            <div className="avatar">
              {perfil.nombre_completo.charAt(0)}
            </div>

            <div>
              <b>{perfil.nombre_completo}</b>
              <span>{perfil.rol}</span>
            </div>
          </div>

          <button
            type="button"
            className="profile-switch"
            onClick={cerrarSesion}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}

      <section className="content">
        <header className="topbar">
          <div>
            <p className="breadcrumb">
              Sistema de Gestión de Incidencias
            </p>

            <h1>
              {vista === "registro" &&
              perfil.rol === "REPRESENTANTE"
                ? "Registrar incidencia"
                : ticketSeleccionado
                  ? "Detalle de incidencia"
                  : "Incidencias registradas"}
            </h1>
          </div>
        </header>

        <div className="page">
          {/* OPCIONES DEL REPRESENTANTE */}

          {perfil.rol === "REPRESENTANTE" && (
            <div
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 20,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="outline"
                onClick={mostrarListado}
              >
                Mis incidencias
              </button>

              <button
                type="button"
                className="primary"
                onClick={mostrarRegistro}
              >
                Registrar incidencia
              </button>
            </div>
          )}

          {/* VISTA DE REGISTRO */}

          {vista === "registro" &&
          perfil.rol === "REPRESENTANTE" ? (
            <RealRegister
              token={sesion.access_token}
              onCancelar={mostrarListado}
              onCreada={async (codigo) => {
                setVista("lista")
                setTicketSeleccionado(null)

                setMensaje(
                  `Incidencia ${codigo} registrada correctamente.`,
                )

                try {
                  const registros =
                    await listarIncidenciasReales(
                      sesion.access_token,
                    )

                  setIncidencias(registros)
                } catch {
                  setMensaje(
                    `Incidencia ${codigo} registrada, ` +
                    "pero no se pudo actualizar el listado.",
                  )
                }
              }}
            />
          ) : ticketSeleccionado ? (
            /* PASO 110D1 - DETALLE REAL */

                        
            <RealTicketDetail
              token={sesion.access_token}
              ticket={ticketSeleccionado}
              rol={perfil.rol}
              onVolver={() => {
                mostrarListado()
                void actualizarIncidencias()
              }}
            />
          ) : (
            /* LISTADO DE INCIDENCIAS */

            <>
              <div className="page-title-row">
                <div>
                  <h2>
                    Seguimiento de incidencias
                  </h2>

                  <p>
                    Registros obtenidos de la API
                    y PostgreSQL.
                  </p>
                </div>

                <button
                  type="button"
                  className="primary"
                  onClick={actualizarIncidencias}
                  disabled={cargando}
                >
                  {cargando
                    ? "Actualizando..."
                    : "Actualizar"}
                </button>
              </div>

              {/* MENSAJES DEL SISTEMA */}

              {mensaje && (
                <div
                  className="auth-error"
                  role="alert"
                >
                  {mensaje}
                </div>
              )}

              {/* TABLA DE INCIDENCIAS */}

              <div
                style={{
                  background: "#fff",
                  border: "1px solid #e1e7ee",
                  borderRadius: 12,
                  padding: 20,
                  overflowX: "auto",
                }}
              >
                <p>
                  <strong>
                    Total de registros:
                  </strong>{" "}
                  {incidencias.length}
                </p>

                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Asunto</th>
                      <th>Estado</th>
                      <th>Prioridad</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>

                  <tbody>
                    {incidencias.map((ticket) => (
                      <tr key={ticket.id}>
                        <td>
                          <button
                            type="button"
                            className="outline"
                            onClick={() =>
                              abrirDetalle(ticket)
                            }
                          >
                            {ticket.codigo}
                          </button>
                        </td>

                        <td>
                          {ticket.asunto}
                        </td>

                        <td>
                          {ticket.estado}
                        </td>

                        <td>
                          {ticket.prioridad ||
                            "Sin definir"}
                        </td>

                        <td>
                          {new Date(
                            ticket.fecha_registro,
                          ).toLocaleDateString(
                            "es-PE",
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {incidencias.length === 0 && (
                  <p>
                    No hay incidencias disponibles
                    para este usuario.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
