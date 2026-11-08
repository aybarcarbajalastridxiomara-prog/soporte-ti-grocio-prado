import { useEffect, useState } from "react"
import "./index.css"

type Profile = "systems" | "assistant" | "intern" | "area"
type Status = "Pendiente" | "En revisión" | "Cerrado"
type Evidence = { name: string size: number url?: string }
type Assignment = {
  tech: string
  by: string
  source: "JEFATURA" | "AUTOTOMA"
  date: string
}
type Intervention = {
  diagnosis: string
  actions: string
  solution?: string
  date: string
  duration: string
  by: string
}
type Ticket = {
  id: string
  code: string
  subject: string
  area: string
  reporter: string
  description: string
  category?: string
  equipment?: string
  location?: string
  evidence?: Evidence[]
  date: string
  startedDate?: string
  startedTime?: string
  impact?: "Sí" | "Parcialmente" | "No"
  recurrence?: {
    previousTicketId?: string
    previousCode?: string
    notes?: string
  }
  verifications?: {
    result: "Sí, estoy conforme" | "No, tengo observaciones"
    observations?: string
    by: string
    area?: string
    date: string
  }[]
  priority: string
  status: Status
  tech: string
  assignments: Assignment[]
  interventions: Intervention[]
  closedBy?: string
  closedAt?: string
  conformity?: string
}
type DemoUser = {
  name: string
  username: string
  password: string
  email: string
  area: string
  role: string
  status: "Habilitado" | "Deshabilitado"
  actions: string
}

const initialUsers: DemoUser[] = [
  {
    name: "Usuario de Tesorería",
    username: "tesoreria",
    password: "demo2026",
    email: "tesoreria@grocioprado.gob.pe",
    area: "Tesorería",
    role: "Representante municipal",
    status: "Habilitado",
    actions: "Registrar y consultar tickets",
  },
  {
    name: "Jefe de Sistemas",
    username: "jefe",
    password: "demo2026",
    email: "jefe.sistemas@grocioprado.gob.pe",
    area: "Unidad de Sistemas",
    role: "Jefe de Sistemas",
    status: "Habilitado",
    actions: "Gestión y autorización",
  },
  {
    name: "Asistente de Sistemas",
    username: "asistente",
    password: "demo2026",
    email: "asistente.sistemas@grocioprado.gob.pe",
    area: "Unidad de Sistemas",
    role: "Asistente de Sistemas",
    status: "Habilitado",
    actions: "Atención técnica autorizada",
  },
  {
    name: "Practicante de Sistemas",
    username: "practicante",
    password: "demo2026",
    email: "practicante.sistemas@grocioprado.gob.pe",
    area: "Unidad de Sistemas",
    role: "Practicante de Sistemas",
    status: "Habilitado",
    actions: "Atención técnica autorizada",
  },
]
const initialTickets: Ticket[] = [
  {
    id: "12",
    code: "INC-2026-0012",
    subject: "Impresora de Tesorería no imprime documentos",
    area: "Tesorería",
    reporter: "Usuario de Tesorería",
    description:
      "La impresora dejó de responder desde la computadora del área.",
    category: "Equipos periféricos",
    equipment: "IMP-TS-004 · HP LaserJet",
    location: "Oficina de Tesorería",
    date: "10 Mar, 09:12",
    priority: "Alta",
    status: "En revisión",
    tech: "Asistente de Sistemas",
    assignments: [
      {
        tech: "Asistente de Sistemas",
        by: "Jefe de Sistemas",
        source: "JEFATURA",
        date: "10 Mar 2026, 10:15",
      },
    ],
    interventions: [
      {
        diagnosis:
          "Se verificó conectividad USB y estado de cola de impresión.",
        actions: "Se limpió la cola de impresión y se reinició el servicio.",
        date: "10 Mar 2026, 10:30",
        duration: "30",
        by: "Asistente de Sistemas",
      },
    ],
  },
  {
    id: "11",
    code: "INC-2026-0011",
    subject: "Problema de acceso a SIAF",
    area: "Contabilidad",
    reporter: "Usuario de Contabilidad",
    description: "No se puede acceder al sistema.",
    date: "10 Mar, 08:30",
    priority: "Media",
    status: "Pendiente",
    tech: "Sin asignar",
    assignments: [],
    interventions: [],
  },
  {
    id: "10",
    code: "INC-2026-0010",
    subject: "Falla de conectividad a internet",
    area: "Rentas",
    reporter: "Usuario de Rentas",
    description: "Sin acceso a internet.",
    date: "09 Mar, 16:10",
    priority: "Media",
    status: "Cerrado",
    tech: "Jefe de Sistemas",
    assignments: [
      {
        tech: "Jefe de Sistemas",
        by: "Jefe de Sistemas",
        source: "AUTOTOMA",
        date: "09 Mar 2026, 16:20",
      },
    ],
    interventions: [
      {
        diagnosis: "Falla de configuración en el router.",
        actions: "Se restauró la configuración WAN.",
        solution: "Conectividad restablecida y validada.",
        date: "09 Mar 2026, 16:40",
        duration: "25",
        by: "Jefe de Sistemas",
      },
    ],
    closedBy: "Jefe de Sistemas",
    closedAt: "09 Mar 2026, 17:10",
  },
  {
    id: "9",
    code: "INC-2026-0009",
    subject: "Equipo de cómputo no enciende",
    area: "Logística",
    reporter: "Usuario de Logística",
    description: "El equipo no inicia.",
    date: "09 Mar, 11:25",
    priority: "Alta",
    status: "Pendiente",
    tech: "Sin asignar",
    assignments: [],
    interventions: [],
  },
]
const now = () =>
  new Date().toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
const INCIDENTS_STORAGE_KEY = "grocio-prado-soporte-ti:incidents:v1"

function normalizeTickets(value: unknown): Ticket[] {
  if (!Array.isArray(value)) return initialTickets
  const validStatuses: Status[] = ["Pendiente", "En revisión", "Cerrado"]
  const normalized = value.filter(
    (ticket): ticket is Partial<Ticket> =>
      !!ticket &&
      typeof ticket === "object" &&
      typeof ticket.id === "string" &&
      typeof ticket.code === "string" &&
      typeof ticket.subject === "string" &&
      validStatuses.includes(ticket.status as Status),
  )
  return normalized.map((ticket) => ({
    ...ticket,
    assignments: Array.isArray(ticket.assignments) ? ticket.assignments : [],
    interventions: Array.isArray(ticket.interventions)
      ? ticket.interventions
      : [],
    evidence: Array.isArray(ticket.evidence)
      ? ticket.evidence.map(({ name, size }) => ({ name, size }))
      : [],
    verifications: Array.isArray(ticket.verifications)
      ? ticket.verifications.map((verification) => ({
          ...verification,
          area: verification.area || ticket.area,
        }))
      : [],
  })) as Ticket[]
}

function loadIncidents(): Ticket[] {
  try {
    const saved = localStorage.getItem(INCIDENTS_STORAGE_KEY)
    return saved ? normalizeTickets(JSON.parse(saved)) : initialTickets
  } catch {
    return initialTickets
  }
}
const profileFor = (user: DemoUser): Profile =>
  user.role === "Jefe de Sistemas"
    ? "systems"
    : user.role === "Asistente de Sistemas"
      ? "assistant"
      : user.role === "Practicante de Sistemas"
        ? "intern"
        : "area"

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z",
    clipboard:
      "M9 3h6l1 2h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3l1-2Zm0 8h6m-6 4h6",
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m14-10a4 4 0 1 0 0-8m6 18v-2a4 4 0 0 0-3-3.87",
    tool: "m14.7 6.3 3 3L7 20H4v-3L14.7 6.3ZM16 5l1.5-1.5a2.12 2.12 0 0 1 3 3L19 8",
    user: "M20 21a8 8 0 0 0-16 0m12-14a4 4 0 1 1-8 0 4 4 0Z",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4",
    search: "m21 21-4.5-4.5M19 11a8 8 0 1 1-16 0 8 8 0Z",
    plus: "M12 5v14m-7-7h14",
    arrow: "m9 18 6-6-6-6",
    check: "m5 12 4 4L19 6",
    clock: "M12 6v6l4 2",
    key: "M21 2l-9.6 9.6m0 0L8 8.2m3.4 3.4-4.8 4.8H3v3.6h3.6v-3.6h3.6l4.8-4.8M16.5 6.5l1 1",
  }
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] || paths.clipboard} />
    </svg>
  )
}
function Badge({ children }: { children: string }) {
  const c =
    children === "Cerrado"
      ? "green"
      : children === "Pendiente"
        ? "amber"
        : children === "Alta"
          ? "red"
          : children === "En revisión" || children === "Media"
            ? "blue"
            : "slate"
  return <span className={`badge ${c}`}>{children}</span>
}

export default function App() {
  const [users, setUsers] = useState(initialUsers)
  const [incidents, setIncidents] = useState<Ticket[]>(loadIncidents)
  const [currentUsername, setCurrentUsername] = useState("")
  const [view, setView] = useState("dashboard")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [userModal, setUserModal] = useState<DemoUser | null | "new">(null)
  const [authPage, setAuthPage] = useState<"login" | "forgot">("login")
  useEffect(() => {
    try {
      localStorage.setItem(INCIDENTS_STORAGE_KEY, JSON.stringify(incidents))
    } catch {
      // The prototype remains usable when localStorage is unavailable.
    }
  }, [incidents])
  const currentUser = users.find((u) => u.username === currentUsername)
  const profile = currentUser ? profileFor(currentUser) : null
  const area = profile === "area"
  const chief = profile === "systems"
  const technician =
    profile === "systems" || profile === "assistant" || profile === "intern"
  const allowed = area
    ? ["dashboard", "list", "register", "detail", "account"]
    : chief
      ? [
          "dashboard",
          "list",
          "assignments",
          "work",
          "detail",
          "users",
          "account",
        ]
      : ["dashboard", "list", "work", "detail", "account"]
  const go = (next: string, ticketId?: string) => {
    if (!allowed.includes(next)) return setView("dashboard")
    if (ticketId) setSelectedId(ticketId)
    setView(next)
    setMenu(false)
  }
  const updateTicket = (id: string, updater: (ticket: Ticket) => Ticket) =>
    setIncidents((all) => all.map((t) => (t.id === id ? updater(t) : t)))
  if (!currentUser || !profile)
    return (
      <Login
        users={users}
        page={authPage}
        setPage={setAuthPage}
        onAccess={(user) => {
          setCurrentUsername(user.username)
          setView("dashboard")
        }}
      />
    )
  const nav = area
    ? [
        ["dashboard", "Panel principal", "dashboard"],
        ["clipboard", "Mis incidencias", "list"],
        ["plus", "Registrar incidencia", "register"],
        ["user", "Mi cuenta", "account"],
      ]
    : chief
      ? [
          ["dashboard", "Panel principal", "dashboard"],
          ["clipboard", "Incidencias", "list"],
          ["users", "Asignaciones", "assignments"],
          ["tool", "Atención técnica", "work"],
          ["user", "Usuarios y áreas", "users"],
          ["user", "Mi cuenta", "account"],
        ]
      : [
          ["dashboard", "Panel principal", "dashboard"],
          ["clipboard", "Incidencias", "list"],
          ["tool", "Mis atenciones", "work"],
          ["user", "Mi cuenta", "account"],
        ]
  const titles: Record<string, string> = {
    dashboard: area ? `Panel de ${currentUser.area}` : "Dashboard general",
    list: area ? "Mis incidencias" : "Incidencias",
    register: "Registrar incidencia",
    detail: "Detalle de incidencia",
    assignments: "Asignaciones",
    work: "Atención técnica",
    users: "Usuarios y áreas",
    account: "Mi cuenta",
  }
  return (
    <main className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="brand">
          <div className="crest">GM</div>
          <div>
            <strong>Soporte TI</strong>
            <span>Grocio Prado</span>
          </div>
        </div>
        <div className="prototype">PROTOTIPO · DATOS DE DEMOSTRACIÓN</div>
        <nav>
          {nav.map(([icon, label, key]) => (
            <button
              key={key}
              className={view === key ? "nav-item active" : "nav-item"}
              onClick={() => go(key)}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="profile-mini account-trigger"
            onClick={() => go("account")}
          >
            <div className="avatar">
              {currentUser.name
                .split(" ")
                .map((x) => x[0])
                .join("")
                .slice(0, 2)}
            </div>
            <div>
              <b>{currentUser.name}</b>
              <span>{currentUser.role}</span>
            </div>
          </button>
          <button
            className="profile-switch"
            onClick={() => {
              setCurrentUsername("")
              setSelectedId(null)
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
      <section className="content">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenu(!menu)}>
            ☰
          </button>
          <div>
            <p className="breadcrumb">
              Sistema de Gestión de Incidencias / {titles[view]}
            </p>
            <h1>{titles[view]}</h1>
          </div>
          <div className="top-actions">
            <button className="icon-button">
              <Icon name="bell" />
              <i />
            </button>
            <button
              className="avatar avatar-button"
              onClick={() => go("account")}
            >
              {currentUser.name
                .split(" ")
                .map((x) => x[0])
                .join("")
                .slice(0, 2)}
            </button>
          </div>
        </header>
        <div className="page">
          {view === "dashboard" && (
            <Dashboard
              area={area}
              chief={chief}
              incidents={incidents}
              go={go}
            />
          )}
          {view === "list" && (
            <List
              incidents={incidents}
              current={currentUser}
              area={area}
              go={go}
            />
          )}
          {view === "register" && area && (
            <RegisterIncident
              user={currentUser}
              incidents={incidents}
              add={(ticket) => setIncidents((old) => [ticket, ...old])}
              go={go}
            />
          )}
          {view === "detail" && (
            <Detail
              ticket={incidents.find(
                (t) =>
                  t.id === selectedId && (!area || t.area === currentUser.area),
              )}
              incidents={incidents}
              current={currentUser}
              chief={chief}
              technician={technician}
              go={go}
              onTake={() =>
                selectedId &&
                updateTicket(selectedId, (t) => ({
                  ...t,
                  tech: currentUser.name,
                  status: "En revisión",
                  assignments: [
                    ...t.assignments,
                    {
                      tech: currentUser.name,
                      by: currentUser.name,
                      source: "AUTOTOMA",
                      date: now(),
                    },
                  ],
                }))
              }
              onPriority={(priority) =>
                selectedId &&
                updateTicket(selectedId, (t) => ({ ...t, priority }))
              }
              onVerification={(verification) =>
                selectedId &&
                updateTicket(selectedId, (t) => ({
                  ...t,
                  verifications: [...(t.verifications || []), verification],
                }))
              }
            />
          )}
          {view === "assignments" && chief && (
            <Assignments
              tickets={incidents}
              users={users}
              go={go}
              assign={(id, tech) =>
                updateTicket(id, (t) => ({
                  ...t,
                  tech,
                  status: t.status === "Pendiente" ? "En revisión" : t.status,
                  assignments: [
                    ...t.assignments,
                    {
                      tech,
                      by: currentUser.name,
                      source: "JEFATURA",
                      date: now(),
                    },
                  ],
                }))
              }
            />
          )}
          {view === "work" && (
            <Work
              tickets={incidents}
              current={currentUser}
              go={go}
              update={updateTicket}
            />
          )}
          {view === "users" && chief && (
            <Users
              users={users}
              open={() => setUserModal("new")}
              edit={(u) => setUserModal(u)}
            />
          )}
          {view === "account" && (
            <Account
              user={currentUser}
              savePassword={(password) =>
                setUsers((all) =>
                  all.map((u) =>
                    u.username === currentUser.username
                      ? { ...u, password }
                      : u,
                  ),
                )
              }
            />
          )}
        </div>
      </section>
      {userModal && (
        <UserModal
          users={users}
          editing={userModal === "new" ? null : userModal}
          close={() => setUserModal(null)}
          save={(user) =>
            setUsers((all) =>
              all.some((u) => u.username === user.username)
                ? all.map((u) => (u.username === user.username ? user : u))
                : [...all, user],
            )
          }
          returnToLogin={() => {
            setUserModal(null)
            setCurrentUsername("")
            setAuthPage("login")
          }}
        />
      )}
    </main>
  )
}

function Login({
  users,
  page,
  setPage,
  onAccess,
}: {
  users: DemoUser[]
  page: string
  setPage: (p: "login" | "forgot") => void
  onAccess: (u: DemoUser) => void
}) {
  const [user, setUser] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [show, setShow] = useState(false)
  const submit = () => {
    const account = users.find(
      (u) =>
        u.username.toLowerCase() === user.trim().toLowerCase() ||
        u.email.toLowerCase() === user.trim().toLowerCase(),
    )
    if (!account || account.password !== password)
      return setMessage(
        "Usuario o contraseña incorrectos. Verifique sus datos.",
      )
    if (account.status === "Deshabilitado")
      return setMessage(
        "Este usuario se encuentra deshabilitado. Contacte a la Unidad de Sistemas.",
      )
    onAccess(account)
  }
  if (page !== "login")
    return <AuthAux page={page} back={() => setPage("login")} />
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="login-brand">
          <div className="crest large">
            Escudo
            <br />
            municipal
          </div>
          <div>
            <p>Municipalidad Distrital de Grocio Prado</p>
            <h1>Soporte TI</h1>
          </div>
        </div>
        <div className="login-copy">
          <h2>Bienvenido</h2>
          <p>
            Ingrese sus credenciales para gestionar incidencias tecnológicas.
          </p>
        </div>
        <label>
          Usuario o correo
          <input value={user} onChange={(e) => setUser(e.target.value)} />
        </label>
        <label>
          Contraseña
          <div className="password-field">
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={() => setShow(!show)}>
              {show ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </label>
        {message && <div className="auth-error">{message}</div>}
        <button className="primary login-submit" onClick={submit}>
          Iniciar sesión
        </button>
        <div className="auth-links">
          <button onClick={() => setPage("forgot")}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <div className="demo-box">
          <b>Modo demostración</b>
          <p>
            Use <code>tesoreria</code>, <code>jefe</code>,{" "}
            <code>asistente</code> o <code>practicante</code> con{" "}
            <code>demo2026</code>.
          </p>
          <button
            onClick={() => {
              setUser("asistente")
              setPassword("demo2026")
            }}
          >
            Acceso Asistente
          </button>
          <button
            onClick={() => {
              setUser("jefe")
              setPassword("demo2026")
            }}
          >
            Acceso Jefe
          </button>
        </div>
      </section>
    </main>
  )
}
function AuthAux({ back }: { back: () => void }) {
  const [done, setDone] = useState(false)
  return (
    <main className="login-screen">
      <section className="login-panel">
        <button className="back" onClick={back}>
          ‹ Volver al acceso
        </button>
        <div className="login-copy">
          <h2>Recuperar acceso</h2>
          <p>
            Ingrese su correo. Por seguridad, la confirmación no revela si
            existe una cuenta.
          </p>
        </div>
        <label>
          Correo electrónico
          <input type="email" />
        </label>
        {done && (
          <div className="success">
            <Icon name="check" />
            <div>
              <b>Solicitud registrada en esta demostración.</b>
              <p>No se envió ningún correo real.</p>
            </div>
          </div>
        )}
        <button className="primary login-submit" onClick={() => setDone(true)}>
          Solicitar recuperación
        </button>
        <p className="help">
          La alternativa B de activación se conserva solo como propuesta para
          evaluación docente; no está habilitada como método operativo.
        </p>
      </section>
    </main>
  )
}

function Dashboard({
  area,
  chief,
  incidents,
  go,
}: {
  area: boolean
  chief: boolean
  incidents: Ticket[]
  go: (v: string, id?: string) => void
}) {
  const data = area
    ? incidents.filter((t) => t.area === "Tesorería")
    : incidents
  const stat = (status: Status) =>
    String(data.filter((t) => t.status === status).length)
  const pendingObservations = incidents.filter((ticket) =>
    ticket.verifications?.some(
      (verification) => verification.result === "No, tengo observaciones",
    ),
  )
  return (
    <>
      <div className="welcome">
        <div>
          <h2>
            {area ? "Resumen de Tesorería" : "Panorama operativo de Sistemas"}
          </h2>
          <p>
            {area
              ? "Revise y registre las incidencias de su área."
              : "Seguimiento consolidado de incidencias municipales."}
          </p>
        </div>
        {area && (
          <button className="primary" onClick={() => go("register")}>
            <Icon name="plus" /> Registrar incidencia
          </button>
        )}
      </div>
      <div className="kpis four">
        {[
          [String(data.length), "Total de incidencias", "blue"],
          [stat("Pendiente"), "Pendientes", "amber"],
          [stat("En revisión"), "En revisión", "blue"],
          [stat("Cerrado"), "Cerradas", "green"],
        ].map(([n, label, color]) => (
          <article className="kpi" key={label}>
            <span className={`kpi-icon ${color}`}>
              <Icon name={color === "green" ? "check" : "clipboard"} />
            </span>
            <div>
              <b>{n}</b>
              <p>{label}</p>
            </div>
          </article>
        ))}
      </div>
      {chief && pendingObservations.length > 0 && (
        <section className="notice observation-notice dashboard-alert">
          <b>Observaciones pendientes de revisión</b>
          <p>
            {pendingObservations.length} incidencia
            {pendingObservations.length === 1 ? "" : "s"} cerrada
            {pendingObservations.length === 1 ? "" : "s"} cuenta
            {pendingObservations.length === 1 ? "" : "n"} con observaciones del
            área solicitante.
          </p>
        </section>
      )}
      <section className="card table-card">
        <div className="section-head">
          <div>
            <h3>Actividad reciente</h3>
            <p>Datos compartidos de la demostración.</p>
          </div>
          <button className="text-button" onClick={() => go("list")}>
            Ver todas <Icon name="arrow" />
          </button>
        </div>
        <TicketTable data={data.slice(0, 5)} go={go} />
      </section>
    </>
  )
}
function TicketTable({
  data,
  go,
  action,
}: {
  data: Ticket[]
  go?: (v: string, id?: string) => void
  action?: (t: Ticket) => React.ReactNode
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Asunto</th>
            <th>Área</th>
            <th>Registro</th>
            <th>Prioridad</th>
            <th>Estado</th>
            <th>Responsable</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.map((t) => (
            <tr key={t.id}>
              <td>
                <b className="code">{t.code}</b>
              </td>
              <td>{t.subject}</td>
              <td>{t.area}</td>
              <td>{t.date}</td>
              <td>
                <Badge>{t.priority}</Badge>
              </td>
              <td>
                <Badge>{t.status}</Badge>
              </td>
              <td>{t.tech}</td>
              <td>
                {action?.(t) || (
                  <button
                    className="row-action"
                    onClick={() => go?.("detail", t.id)}
                  >
                    Ver <Icon name="arrow" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function List({
  incidents,
  current,
  area,
  go,
}: {
  incidents: Ticket[]
  current: DemoUser
  area: boolean
  go: (v: string, id?: string) => void
}) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<"Todas" | Status>("Todas")
  const data = incidents.filter(
    (t) =>
      (!area || t.area === current.area) &&
      (status === "Todas" || t.status === status) &&
      `${t.code} ${t.subject}`.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <>
      <div className="page-title-row">
        <div>
          <h2>{area ? "Mis incidencias" : "Listado general de incidencias"}</h2>
          <p>
            {area
              ? "Tickets registrados para su área."
              : "Consulte los tickets autorizados."}
          </p>
        </div>
        {area && (
          <button className="primary" onClick={() => go("register")}>
            <Icon name="plus" /> Registrar incidencia
          </button>
        )}
      </div>
      <section className="card table-card">
        <div className="filters">
          <label className="search">
            <Icon name="search" />
            <input
              placeholder="Buscar por código o asunto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar por estado"
            value={status}
            onChange={(e) => setStatus(e.target.value as "Todas" | Status)}
          >
            <option>Todas</option>
            <option>Pendiente</option>
            <option>En revisión</option>
            <option>Cerrado</option>
          </select>
        </div>
        {data.length ? (
          <TicketTable data={data} go={go} />
        ) : (
          <div className="empty">
            <h3>Sin resultados</h3>
          </div>
        )}
      </section>
    </>
  )
}
function RegisterIncident({
  user,
  incidents,
  add,
  go,
}: {
  user: DemoUser
  incidents: Ticket[]
  add: (t: Ticket) => void
  go: (v: string, id?: string) => void
}) {
  const [registrationDate] = useState(() => now())
  const [form, setForm] = useState({
    subject: "",
    description: "",
    category: "",
    equipment: "",
    location: "",
    startedDate: "",
    startedTime: "",
    impact: "Parcialmente" as Ticket["impact"],
    repeated: "No",
    previousTicketId: "",
    previousNotes: "",
  })
  const [files, setFiles] = useState<Evidence[]>([])
  const [error, setError] = useState("")
  const areaTickets = incidents.filter((ticket) => ticket.area === user.area)
  const previousTicket = areaTickets.find(
    (ticket) => ticket.id === form.previousTicketId,
  )
  const today = new Date().toISOString().slice(0, 10)
  const submit = () => {
    if (!form.subject.trim() || !form.description.trim())
      return setError("El asunto y la descripción detallada son obligatorios.")
    if (form.startedDate && form.startedDate > today)
      return setError(
        "La fecha aproximada no puede ser posterior al momento de registro.",
      )
    if (
      form.startedDate &&
      form.startedTime &&
      new Date(`${form.startedDate}T${form.startedTime}`) > new Date()
    )
      return setError(
        "La fecha y hora aproximadas no pueden estar en el futuro.",
      )
    const id = crypto.randomUUID()
    add({
      id,
      code: `INC-2026-${String(Date.now()).slice(-4)}`,
      subject: form.subject.trim(),
      description: form.description.trim(),
      area: user.area,
      reporter: user.name,
      category: form.category,
      equipment: form.equipment,
      location: form.location,
      evidence: files,
      date: registrationDate,
      startedDate: form.startedDate || undefined,
      startedTime: form.startedTime || undefined,
      impact: form.impact,
      recurrence:
        form.repeated === "Sí"
          ? {
              previousTicketId: previousTicket?.id,
              previousCode: previousTicket?.code,
              notes: form.previousNotes.trim() || undefined,
            }
          : undefined,
      priority: "Sin asignar",
      status: "Pendiente",
      tech: "Sin asignar",
      assignments: [],
      interventions: [],
    })
    go("detail", id)
  }
  const upload = (list: FileList | null) => {
    if (!list) return
    const selected = Array.from(list)
    const invalid = selected.find(
      (file) =>
        !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
          file.type,
        ) || file.size > 10 * 1024 * 1024,
    )
    if (invalid)
      return setError(
        "Solo se aceptan JPG, PNG, WebP o PDF de hasta 10 MB por archivo.",
      )
    setFiles((current) => [
      ...current,
      ...selected.map((file) => ({
        name: file.name,
        size: file.size,
        url: file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined,
      })),
    ])
    setError("")
  }
  return (
    <>
      <button className="back" onClick={() => go("dashboard")}>
        ‹ Cancelar y volver
      </button>
      <div className="page-title-row">
        <div>
          <h2>Registrar nueva incidencia</h2>
          <p>Complete los datos para que Sistemas pueda evaluar el caso.</p>
        </div>
        <Badge>Pendiente</Badge>
      </div>
      <section className="form-card register-form">
        <h3>A. Información del solicitante</h3>
        <div className="form-row form-row-three">
          <label>
            Área municipal
            <input value={user.area} disabled />
          </label>
          <label>
            Reportante autorizado
            <input value={user.name} disabled />
          </label>
          <label>
            Fecha y hora de registro
            <input value={registrationDate} disabled />
          </label>
        </div>
        <h3>B. Descripción de la incidencia</h3>
        <label>
          Asunto de la incidencia <b className="required">*</b>
          <input
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
        </label>
        <label>
          Descripción detallada <b className="required">*</b>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <div className="form-row form-row-three">
          <label>
            Categoría provisional
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              <option value="">Seleccione</option>
              <option>Equipos periféricos</option>
              <option>Conectividad</option>
              <option>Acceso a sistemas</option>
              <option>Equipo de cómputo</option>
            </select>
          </label>
          <label>
            Equipo o sistema afectado
            <input
              value={form.equipment}
              onChange={(e) => setForm({ ...form, equipment: e.target.value })}
            />
          </label>
          <label>
            Oficina o ubicación
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </label>
        </div>
        <div className="form-row form-row-three">
          <label>
            ¿Cuándo comenzó el problema?
            <input
              type="date"
              max={today}
              value={form.startedDate}
              onChange={(e) =>
                setForm({ ...form, startedDate: e.target.value })
              }
            />
          </label>
          <label>
            Hora aproximada
            <input
              type="time"
              value={form.startedTime}
              onChange={(e) =>
                setForm({ ...form, startedTime: e.target.value })
              }
            />
          </label>
          <label>
            ¿El problema le impide continuar con sus actividades?
            <select
              value={form.impact}
              onChange={(e) =>
                setForm({ ...form, impact: e.target.value as Ticket["impact"] })
              }
            >
              <option>Sí</option>
              <option>Parcialmente</option>
              <option>No</option>
            </select>
            <span className="help">
              Esta información ayuda a evaluar la incidencia, pero no determina
              automáticamente su prioridad
            </span>
          </label>
        </div>
        <h3>C. Antecedentes del problema</h3>
        <label>
          ¿Este problema ya ocurrió anteriormente?
          <select
            value={form.repeated}
            onChange={(e) =>
              setForm({
                ...form,
                repeated: e.target.value,
                previousTicketId: "",
                previousNotes: "",
              })
            }
          >
            <option>No</option>
            <option>Sí</option>
          </select>
        </label>
        {form.repeated === "Sí" && (
          <div className="recurrence-fields">
            <div className="notice">
              <b>Información relacionada</b>
              <p>
                Este antecedente es una simulación informativa: no reutiliza
                códigos ni reabre incidencias.
              </p>
            </div>
            <label>
              Código de incidencia anterior (opcional)
              <select
                value={form.previousTicketId}
                onChange={(e) =>
                  setForm({ ...form, previousTicketId: e.target.value })
                }
              >
                <option value="">No conozco el código</option>
                {areaTickets.map((ticket) => (
                  <option value={ticket.id} key={ticket.id}>
                    {ticket.code} · {ticket.subject}
                  </option>
                ))}
              </select>
            </label>
            {previousTicket && (
              <div className="previous-ticket-summary">
                <b>{previousTicket.code}</b>
                <p>{previousTicket.subject}</p>
                <span>
                  Registrada: {previousTicket.date} · Estado:{" "}
                  {previousTicket.status}
                </span>
                <span>
                  Solución anterior:{" "}
                  {[...previousTicket.interventions]
                    .reverse()
                    .find((intervention) => intervention.solution)?.solution ||
                    "No registrada"}
                </span>
              </div>
            )}
            {previousTicket && previousTicket.status !== "Cerrado" && (
              <div className="notice">
                <b>Incidencia anterior aún abierta</b>
                <p>
                  {previousTicket.code} sigue en estado {previousTicket.status}.
                  Revise el caso para evitar una posible duplicación; el
                  tratamiento definitivo requiere validación.
                </p>
              </div>
            )}
            <label>
              Observaciones sobre la falla anterior
              <textarea
                value={form.previousNotes}
                onChange={(e) =>
                  setForm({ ...form, previousNotes: e.target.value })
                }
                placeholder="Describa la recurrencia si no conoce el código anterior."
              />
            </label>
          </div>
        )}
        <h3>D. Fotografías y archivos</h3>
        <label className="upload-zone">
          Adjunte evidencias opcionales (JPG, PNG, WebP o PDF; máximo 10 MB por
          archivo)
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={(e) => upload(e.target.files)}
          />
        </label>
        {files.map((file, i) => (
          <div className="file-row" key={`${file.name}-${i}`}>
            {file.url && <img src={file.url} alt="" />}
            <span>
              {file.name} · {(file.size / 1024).toFixed(1)} KB
            </span>
            <button
              className="row-action"
              onClick={() => setFiles(files.filter((_, index) => index !== i))}
            >
              Retirar
            </button>
          </div>
        ))}
        {error && <div className="auth-error">{error}</div>}
        <div className="modal-actions">
          <button className="outline" onClick={() => go("dashboard")}>
            Cancelar
          </button>
          <button className="primary" onClick={submit}>
            Registrar incidencia
          </button>
        </div>
      </section>
    </>
  )
}

function Detail({
  ticket,
  incidents,
  current,
  chief,
  technician,
  go,
  onTake,
  onPriority,
  onVerification,
}: {
  ticket?: Ticket
  incidents: Ticket[]
  current: DemoUser
  chief: boolean
  technician: boolean
  go: (v: string, id?: string) => void
  onTake: () => void
  onPriority: (p: string) => void
  onVerification: (
    verification: NonNullable<Ticket["verifications"]>[number],
  ) => void
}) {
  if (!ticket) return <EmptySelection go={go} />
  const own = ticket.tech === current.name
  const unassigned = ticket.tech === "Sin asignar"
  const linkedTickets = incidents.filter(
    (candidate) => candidate.recurrence?.previousTicketId === ticket.id,
  )
  return (
    <>
      <button className="back" onClick={() => go("list")}>
        ‹ Volver a incidencias
      </button>
      <div className="detail-header">
        <div>
          <p className="code">{ticket.code}</p>
          <h2>{ticket.subject}</h2>
          <p>
            Registrada el {ticket.date} por {ticket.reporter}
          </p>
        </div>
        <Badge>{ticket.status}</Badge>
      </div>
      <div className="detail-grid">
        <div className="stack">
          <section className="card detail-card">
            <h3>Descripción de la incidencia</h3>
            <p>{ticket.description}</p>
            <div className="info-grid">
              <div>
                <span>Área solicitante</span>
                <b>{ticket.area}</b>
              </div>
              <div>
                <span>Categoría</span>
                <b>{ticket.category || "Sin clasificar"}</b>
              </div>
              <div>
                <span>Equipo afectado</span>
                <b>{ticket.equipment || "No especificado"}</b>
              </div>
              <div>
                <span>Ubicación</span>
                <b>{ticket.location || "No especificada"}</b>
              </div>
              <div>
                <span>Inicio aproximado</span>
                <b>
                  {ticket.startedDate
                    ? `${ticket.startedDate}${
                        ticket.startedTime ? ` · ${ticket.startedTime}` : ""
                      }`
                    : "No informado"}
                </b>
              </div>
              <div>
                <span>Impacto en actividades</span>
                <b>{ticket.impact || "No informado"}</b>
              </div>
            </div>
            {ticket.recurrence && (
              <div className="evidence recurrence-detail">
                <h3>Antecedentes del problema</h3>
                <p>
                  <b>Incidencia anterior: </b>
                  {ticket.recurrence.previousCode || "Código no informado"}
                </p>
                {ticket.recurrence.notes && (
                  <p>
                    <b>Observaciones: </b>
                    {ticket.recurrence.notes}
                  </p>
                )}
              </div>
            )}
            {linkedTickets.length > 0 && (
              <div className="evidence recurrence-detail">
                <h3>Incidencias relacionadas</h3>
                {linkedTickets.map((linked) => (
                  <button
                    className="row-action"
                    key={linked.id}
                    onClick={() => go("detail", linked.id)}
                  >
                    {linked.code} · {linked.subject} <Icon name="arrow" />
                  </button>
                ))}
              </div>
            )}
            {ticket.evidence?.length ? (
              <div className="evidence">
                <h3>Evidencias adjuntas</h3>
                {ticket.evidence.map((e, i) => (
                  <div className="file-row" key={`${e.name}-${i}`}>
                    {e.url && <img src={e.url} alt={`Evidencia ${e.name}`} />}
                    <span>
                      {e.name} · {(e.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
          {(chief || own || current.role === "Representante municipal") &&
            (ticket.verifications?.length || 0) > 0 && (
              <VerificationSummary ticket={ticket} />
            )}
          <History ticket={ticket} />
        </div>
        <aside className="stack">
          <section className="card side-card">
            <h3>Gestión del ticket</h3>
            <label>
              Prioridad{" "}
              {chief ? (
                <select
                  value={ticket.priority}
                  onChange={(e) => onPriority(e.target.value)}
                >
                  <option>Alta</option>
                  <option>Media</option>
                  <option>Baja</option>
                </select>
              ) : (
                <div className="dependency">{ticket.priority}</div>
              )}
            </label>
            <label>
              Responsable<div className="dependency">{ticket.tech}</div>
            </label>
            {chief && (
              <button
                className="primary full"
                onClick={() => go("assignments")}
              >
                Asignar o reasignar
              </button>
            )}
            {technician && unassigned && ticket.status !== "Cerrado" && (
              <button className="primary full" onClick={onTake}>
                Tomar incidencia
              </button>
            )}
            {technician && own && ticket.status !== "Cerrado" && (
              <button
                className="outline full"
                onClick={() => go("work", ticket.id)}
              >
                Registrar atención
              </button>
            )}
          </section>
          {!chief && technician && !unassigned && !own && (
            <section className="notice">
              <b>Atención restringida</b>
              <p>
                Solo el responsable activo puede registrar intervenciones o
                cerrar este ticket.
              </p>
            </section>
          )}
          {current.role === "Representante municipal" &&
            ticket.status === "Cerrado" && (
              <Conformity
                ticket={ticket}
                user={current}
                save={onVerification}
              />
            )}
          {ticket.verifications?.some(
            (verification) => verification.result === "No, tengo observaciones",
          ) && (
            <section className="notice observation-notice">
              <b>Observación del área pendiente de revisión</b>
              <p>
                La incidencia continúa cerrada; esta indicación es
                complementaria para Sistemas.
              </p>
            </section>
          )}
        </aside>
      </div>
    </>
  )
}
function VerificationSummary({ ticket }: { ticket: Ticket }) {
  return (
    <section className="card verification-card">
      <h3>Verificación del área solicitante</h3>
      {ticket.verifications?.map((verification, index) => (
        <div
          className="verification-entry"
          key={`${verification.date}-${index}`}
        >
          <Badge>
            {verification.result === "Sí, estoy conforme"
              ? "Conforme"
              : "Con observaciones"}
          </Badge>
          <div className="info-grid">
            <div>
              <span>Descripción de la observación</span>
              <b>{verification.observations || "Sin observaciones."}</b>
            </div>
            <div>
              <span>Usuario que respondió</span>
              <b>{verification.by}</b>
            </div>
            <div>
              <span>Área municipal</span>
              <b>{verification.area || ticket.area}</b>
            </div>
            <div>
              <span>Fecha y hora</span>
              <b>{verification.date}</b>
            </div>
            <div>
              <span>Técnico que realizó la atención</span>
              <b>{ticket.tech}</b>
            </div>
          </div>
        </div>
      ))}
    </section>
  )
}
function History({ ticket }: { ticket: Ticket }) {
  const events = [
    ...ticket.assignments.map((a) => ({
      title: `${
        a.source === "AUTOTOMA" ? "Autotoma" : "Asignación de Jefatura"
      }: ${a.tech}`,
      by: a.by,
      date: a.date,
    })),
    ...ticket.interventions.map((i) => ({
      title: i.solution
        ? "Solución final documentada"
        : "Intervención técnica registrada",
      by: i.by,
      date: i.date,
    })),
    ...(ticket.closedAt
      ? [
          {
            title: "Incidencia cerrada técnicamente",
            by: ticket.closedBy || "",
            date: ticket.closedAt,
          },
        ]
      : []),
    ...(ticket.verifications || []).map((verification) => ({
      title:
        verification.result === "Sí, estoy conforme"
          ? "Conformidad registrada por el área"
          : "Observación registrada por el área",
      by: verification.by,
      date: verification.date,
    })),
  ].reverse()
  return (
    <section className="card timeline">
      <h3>Historial de atención</h3>
      {events.length ? (
        events.map((e, i) => (
          <div className="timeline-item" key={`${e.title}-${i}`}>
            <i className={i === 0 ? "done" : ""} />
            <div>
              <b>{e.title}</b>
              <p>
                {e.date} · {e.by}
              </p>
            </div>
          </div>
        ))
      ) : (
        <p className="help">
          Aún no se registran asignaciones ni intervenciones.
        </p>
      )}
    </section>
  )
}
function Conformity({
  ticket,
  user,
  save,
}: {
  ticket: Ticket
  user: DemoUser
  save: (verification: NonNullable<Ticket["verifications"]>[number]) => void
}) {
  const [result, setResult] =
    useState<"Sí, estoy conforme" | "No, tengo observaciones">(
      "Sí, estoy conforme",
    )
  const [text, setText] = useState("")
  const [error, setError] = useState("")
  const existing = ticket.verifications || []
  if (existing.length)
    return (
      <section className="card side-card">
        <h3>Verificación de la atención recibida</h3>
        <div className="dependency">
          Ya registró una respuesta para esta incidencia. La verificación se
          conserva en el historial.
        </div>
      </section>
    )
  const submit = () => {
    if (result === "No, tengo observaciones" && !text.trim())
      return setError("Describa sus observaciones para registrar la respuesta.")
    save({
      result,
      observations: text.trim() || undefined,
      by: user.name,
      area: user.area,
      date: now(),
    })
  }
  const solution = [...ticket.interventions]
    .reverse()
    .find((intervention) => intervention.solution)?.solution
  return (
    <section className="card side-card">
      <h3>Verificación de la atención recibida</h3>
      <div className="solution-summary">
        <b>Resumen de la solución técnica</b>
        <p>{solution || "No se registró una solución final."}</p>
      </div>
      <label>
        ¿La atención brindada solucionó el problema?
        <select
          value={result}
          onChange={(e) =>
            setResult(
              e.target
                .value as "Sí, estoy conforme" | "No, tengo observaciones",
            )
          }
        >
          <option>Sí, estoy conforme</option>
          <option>No, tengo observaciones</option>
        </select>
      </label>
      {result === "No, tengo observaciones" && (
        <label>
          Describa sus observaciones
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Indique la observación sobre la atención recibida."
          />
        </label>
      )}
      {error && <div className="auth-error">{error}</div>}
      <button className="outline full" onClick={submit}>
        Registrar respuesta
      </button>
    </section>
  )
}
function Assignments({
  tickets,
  users,
  go,
  assign,
}: {
  tickets: Ticket[]
  users: DemoUser[]
  go: (v: string, id?: string) => void
  assign: (id: string, tech: string) => void
}) {
  const [selected, setSelected] = useState("")
  const [tech, setTech] = useState("")
  const candidates = users.filter(
    (u) =>
      [
        "Jefe de Sistemas",
        "Asistente de Sistemas",
        "Practicante de Sistemas",
      ].includes(u.role) && u.status === "Habilitado",
  )
  const active = tickets.filter((t) => t.status !== "Cerrado")
  const submit = () => {
    if (selected && tech) {
      assign(selected, tech)
      setSelected("")
      setTech("")
    }
  }
  return (
    <>
      <div className="page-title-row">
        <div>
          <h2>Asignación de incidencias</h2>
          <p>
            Acción exclusiva de Jefatura; se conserva el historial de
            responsables.
          </p>
        </div>
      </div>
      <section className="card form-card">
        <h3>Asignar o reasignar incidencia</h3>
        <div className="form-row">
          <label>
            Incidencia
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Seleccione un ticket</option>
              {active.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.code} · {t.subject} ({t.tech})
                </option>
              ))}
            </select>
          </label>
          <label>
            Responsable autorizado
            <select value={tech} onChange={(e) => setTech(e.target.value)}>
              <option value="">Seleccione responsable</option>
              {candidates.map((u) => (
                <option value={u.name} key={u.username}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="primary"
          disabled={!selected || !tech}
          onClick={submit}
        >
          Guardar asignación
        </button>
      </section>
      <section className="card table-card">
        <div className="section-head">
          <div>
            <h3>Asignaciones activas</h3>
            <p>Incluye tickets libres y responsables activos.</p>
          </div>
        </div>
        <TicketTable data={active} go={go} />
      </section>
    </>
  )
}
function Work({
  tickets,
  current,
  go,
  update,
}: {
  tickets: Ticket[]
  current: DemoUser
  go: (v: string, id?: string) => void
  update: (id: string, fn: (t: Ticket) => Ticket) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const ticket = tickets.find((t) => t.id === selected)
  const own = tickets.filter(
    (t) => t.tech === current.name && t.status !== "Cerrado",
  )
  const ownPendingObservations = tickets.filter(
    (t) =>
      t.tech === current.name &&
      t.verifications?.some(
        (verification) => verification.result === "No, tengo observaciones",
      ),
  )
  if (!ticket)
    return (
      <>
        <div className="page-title-row">
          <div>
            <h2>Mis atenciones</h2>
            <p>
              Seleccione uno de sus tickets activos para documentar la atención.
            </p>
          </div>
        </div>
        {ownPendingObservations.length > 0 && (
          <section className="notice observation-notice dashboard-alert">
            <b>Observación pendiente de revisión</b>
            <p>
              Tiene {ownPendingObservations.length} ticket
              {ownPendingObservations.length === 1 ? "" : "s"} con observaciones
              del área solicitante.
            </p>
          </section>
        )}
        <section className="card table-card">
          <TicketTable
            data={own}
            action={(t) => (
              <button className="row-action" onClick={() => setSelected(t.id)}>
                Atender <Icon name="arrow" />
              </button>
            )}
          />
        </section>
        {!own.length && (
          <section className="empty">
            <h3>No tiene tickets activos asignados</h3>
            <p>Puede tomar una incidencia sin responsable desde su detalle.</p>
          </section>
        )}
      </>
    )
  return (
    <WorkForm
      ticket={ticket}
      current={current}
      back={() => setSelected(null)}
      update={update}
    />
  )
}
function WorkForm({
  ticket,
  current,
  back,
  update,
}: {
  ticket: Ticket
  current: DemoUser
  back: () => void
  update: (id: string, fn: (t: Ticket) => Ticket) => void
}) {
  const [diagnosis, setDiagnosis] = useState("")
  const [actions, setActions] = useState("")
  const [duration, setDuration] = useState("")
  const [solution, setSolution] = useState("")
  const [message, setMessage] = useState("")
  const save = () => {
    if (!diagnosis.trim() || !actions.trim())
      return setMessage(
        "El diagnóstico y las acciones realizadas son obligatorios.",
      )
    update(ticket.id, (t) => ({
      ...t,
      status: "En revisión",
      interventions: [
        ...t.interventions,
        {
          diagnosis,
          actions,
          solution: solution.trim() || undefined,
          duration,
          date: now(),
          by: current.name,
        },
      ],
    }))
    setDiagnosis("")
    setActions("")
    setDuration("")
    setSolution("")
    setMessage("Intervención registrada en el historial compartido.")
  }
  const canClose = ticket.interventions.some(
    (i) => i.diagnosis && i.actions && i.solution,
  )
  const close = () => {
    if (!canClose)
      return setMessage(
        "Para cerrar, documente diagnóstico, acciones y una solución final.",
      )
    update(ticket.id, (t) => ({
      ...t,
      status: "Cerrado",
      closedBy: current.name,
      closedAt: now(),
    }))
    back()
  }
  return (
    <>
      <button className="back" onClick={back}>
        ‹ Volver a mis atenciones
      </button>
      <div className="page-title-row">
        <div>
          <p className="code">{ticket.code}</p>
          <h2>{ticket.subject}</h2>
          <p>
            {ticket.area} · Responsable: {ticket.tech}
          </p>
        </div>
        <Badge>{ticket.status}</Badge>
      </div>
      <div className="work-grid">
        <section className="card form-card">
          <h3>Nueva intervención</h3>
          <label>
            Diagnóstico técnico
            <textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
            />
          </label>
          <label>
            Acciones realizadas
            <textarea
              value={actions}
              onChange={(e) => setActions(e.target.value)}
            />
          </label>
          <div className="form-row">
            <label>
              Fecha y hora
              <input value={now()} disabled />
            </label>
            <label>
              Duración (min.)
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </label>
          </div>
          <label>
            Solución aplicada (requerida para cierre)
            <textarea
              value={solution}
              onChange={(e) => setSolution(e.target.value)}
            />
          </label>
          {message && (
            <div
              className={
                message.startsWith("Intervención") ? "success" : "auth-error"
              }
            >
              {message}
            </div>
          )}
          <button className="primary" onClick={save}>
            <Icon name="check" /> Guardar intervención
          </button>
        </section>
        <History ticket={ticket} />
      </div>
      <section className="card solution-strip">
        <div>
          <b>Cierre técnico</b>
          <p>
            Se habilita tras documentar diagnóstico, acciones y solución final.
          </p>
        </div>
        <button className="primary" disabled={!canClose} onClick={close}>
          Cerrar incidencia
        </button>
      </section>
    </>
  )
}
function EmptySelection({ go }: { go: (v: string) => void }) {
  return (
    <section className="empty">
      <h3>Seleccione una incidencia</h3>
      <p>Abra un ticket desde el listado para ver su información.</p>
      <button className="outline" onClick={() => go("list")}>
        Ir a incidencias
      </button>
    </section>
  )
}
function Account({
  user,
  savePassword,
}: {
  user: DemoUser
  savePassword: (password: string) => void
}) {
  const [current, setCurrent] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [message, setMessage] = useState("")
  const submit = () => {
    if (current !== user.password)
      return setMessage("La contraseña actual no es correcta.")
    if (password.length < 8)
      return setMessage("La nueva contraseña debe tener al menos 8 caracteres.")
    if (password !== confirm) return setMessage("La confirmación no coincide.")
    savePassword(password)
    setCurrent("")
    setPassword("")
    setConfirm("")
    setMessage(
      "Contraseña actualizada. Se mostraría un aviso por correo en esta simulación; no se envió ningún mensaje real.",
    )
  }
  return (
    <>
      <div className="page-title-row">
        <div>
          <h2>Mi cuenta</h2>
          <p>Datos del perfil autenticado y seguridad de acceso.</p>
        </div>
      </div>
      <div className="account-grid">
        <section className="card form-card">
          <h3>Mis datos</h3>
          <label>
            Nombre completo
            <input value={user.name} disabled />
          </label>
          <label>
            Nombre de usuario
            <input value={user.username} disabled />
          </label>
          <label>
            Correo electrónico
            <input value={user.email} disabled />
          </label>
          <div className="form-row">
            <label>
              Área municipal
              <input value={user.area} disabled />
            </label>
            <label>
              Rol
              <input value={user.role} disabled />
            </label>
          </div>
          <label>
            Estado de cuenta
            <input value={user.status} disabled />
          </label>
          <p className="help">
            Los datos administrativos son de solo lectura para el propio
            usuario.
          </p>
        </section>
        <section className="card form-card">
          <h3>Seguridad</h3>
          <label>
            Contraseña actual
            <div className="password-field">
              <input
                type={show ? "text" : "password"}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
              <button type="button" onClick={() => setShow(!show)}>
                {show ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>
          <label>
            Nueva contraseña
            <input
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label>
            Confirmar nueva contraseña
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {message && (
            <div
              className={
                message.includes("actualizada") ? "success" : "auth-error"
              }
            >
              {message}
            </div>
          )}
          <button className="primary" onClick={submit}>
            <Icon name="key" /> Cambiar contraseña
          </button>
        </section>
      </div>
    </>
  )
}
function Users({
  users,
  open,
  edit,
}: {
  users: DemoUser[]
  open: () => void
  edit: (u: DemoUser) => void
}) {
  return (
    <>
      <div className="page-title-row">
        <div>
          <h2>Gestión de usuarios y áreas</h2>
          <p>Administración exclusiva del Jefe de Sistemas.</p>
        </div>
        <button className="primary" onClick={open}>
          <Icon name="plus" /> Nuevo usuario
        </button>
      </div>
      <section className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Área</th>
                <th>Rol</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.username}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.area}</td>
                  <td>{u.role}</td>
                  <td>
                    <Badge>{u.status}</Badge>
                  </td>
                  <td>
                    <button className="row-action" onClick={() => edit(u)}>
                      Editar <Icon name="arrow" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
function UserModal({
  users,
  editing,
  close,
  save,
  returnToLogin,
}: {
  users: DemoUser[]
  editing: DemoUser | null
  close: () => void
  save: (u: DemoUser) => void
  returnToLogin: () => void
}) {
  const [form, setForm] = useState(
    editing
      ? { ...editing }
      : {
          name: "",
          username: "",
          email: "",
          password: "",
          area: "",
          role: "Representante municipal",
          status: "Habilitado" as const,
          actions: "",
        },
  )
  const [phase, setPhase] =
    useState<"form" | "email" | "activate" | "complete">("form")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [error, setError] = useState("")
  const newUser: DemoUser = {
    ...form,
    password: password || "pendiente-de-activacion",
    actions:
      form.role === "Representante municipal"
        ? "Registrar y consultar tickets"
        : "Atención técnica autorizada",
  }
  const submit = () => {
    if (!form.name || !form.username || !form.email || !form.area)
      return setError("Complete nombre, usuario, correo y área.")
    if (
      users.some(
        (u) => u.username === form.username && u.username !== editing?.username,
      )
    )
      return setError("El usuario ya existe.")
    if (editing) {
      save({ ...newUser, password: editing.password })
      return close()
    }
    save(newUser)
    setPhase("email")
  }
  const activate = () => {
    if (password.length < 8)
      return setError("La contraseña debe tener al menos 8 caracteres.")
    if (password !== confirm) return setError("La confirmación no coincide.")
    save({ ...newUser, password })
    setError("")
    setPhase("complete")
  }
  const roleFunctions =
    form.role === "Representante municipal"
      ? "Registrar incidencias, adjuntar evidencias y consultar las incidencias de su área."
      : form.role === "Jefe de Sistemas"
        ? "Administrar usuarios, asignar incidencias y supervisar la atención técnica."
        : "Consultar, tomar y atender incidencias propias; registrar soluciones y cierres autorizados."
  if (phase === "email")
    return (
      <div className="overlay">
        <section className="modal invitation-modal">
          <div className="email-head">
            <div className="crest">GM</div>
            <div>
              <b>Municipalidad Distrital de Grocio Prado</b>
              <span>Sistema de Soporte TI</span>
            </div>
          </div>
          <div className="prototype">SIMULACIÓN DE CORREO · NO FUE ENVIADO</div>
          <h2>Bienvenido al Sistema de Soporte TI</h2>
          <p>
            Hola, <b>{form.name}</b>. Se registró una invitación para activar su
            cuenta.
          </p>
          <div className="invite-data">
            <p>
              <span>Usuario</span>
              <b>{form.username}</b>
            </p>
            <p>
              <span>Área</span>
              <b>{form.area}</b>
            </p>
            <p>
              <span>Rol</span>
              <b>{form.role}</b>
            </p>
          </div>
          <div className="invite-functions">
            <b>Funciones autorizadas</b>
            <p>{roleFunctions}</p>
          </div>
          <button
            className="primary activation-button"
            onClick={() => setPhase("activate")}
          >
            ACTIVAR MI CUENTA
          </button>
        </section>
      </div>
    )
  if (phase === "activate")
    return (
      <div className="overlay">
        <section className="modal">
          <div className="modal-icon">
            <Icon name="key" />
          </div>
          <h2>Activar mi cuenta</h2>
          <p>
            Establezca su contraseña para completar la activación simulada de{" "}
            <b>{form.username}</b>.
          </p>
          <label>
            Nueva contraseña
            <div className="password-field">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShow(!show)}>
                {show ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>
          <label>
            Confirmar contraseña
            <input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="primary full" onClick={activate}>
            Completar activación
          </button>
        </section>
      </div>
    )
  if (phase === "complete")
    return (
      <div className="overlay">
        <section className="modal activation-complete">
          <div className="modal-icon">
            <Icon name="check" />
          </div>
          <h2>Tu cuenta ha sido activada</h2>
          <p>Ya puedes iniciar sesión con tu usuario y la contraseña creada.</p>
          <div className="success">
            <Icon name="check" />
            <div>
              <b>Activación simulada completada.</b>
              <p>No se envió ningún correo real.</p>
            </div>
          </div>
          <button className="primary full" onClick={returnToLogin}>
            Ir al inicio de sesión
          </button>
        </section>
      </div>
    )
  return (
    <div className="overlay" onMouseDown={close}>
      <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={close}>
          ×
        </button>
        <div className="modal-icon">
          <Icon name="user" />
        </div>
        <h2>{editing ? "Editar usuario" : "Nuevo usuario"}</h2>
        <p>
          {editing
            ? "Gestione estado, área y rol con permisos de Jefatura."
            : "Al crear la invitación verá el correo institucional simulado y el recorrido de activación."}
        </p>
        <label>
          Nombre completo
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label>
          Usuario
          <input
            disabled={!!editing}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
        </label>
        <label>
          Correo electrónico
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          Área municipal
          <select
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
          >
            <option value="">Seleccione</option>
            {[
              "Tesorería",
              "Contabilidad",
              "Rentas",
              "Logística",
              "Unidad de Sistemas",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Rol
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {[
                "Representante municipal",
                "Jefe de Sistemas",
                "Asistente de Sistemas",
                "Practicante de Sistemas",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as DemoUser["status"],
                })
              }
            >
              <option>Habilitado</option>
              <option>Deshabilitado</option>
            </select>
          </label>
        </div>
        {!editing && (
          <div className="notice">
            <b>Flujo principal: invitación por correo</b>
            <p>
              La cuenta quedará pendiente de activación hasta que el usuario
              cree su contraseña en esta simulación.
            </p>
          </div>
        )}
        {error && <div className="auth-error">{error}</div>}
        <div className="modal-actions">
          <button className="outline" onClick={close}>
            Cancelar
          </button>
          <button className="primary" onClick={submit}>
            {editing ? "Guardar usuario" : "Crear invitación"}
          </button>
        </div>
      </section>
    </div>
  )
}
