export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    clipboard: "M9 3h6l1 2h3v16H5V5h3zM9 11h6M9 15h6",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    tool: "m14.7 6.3 3 3L7 20H4v-3L14.7 6.3ZM16 5l1.5-1.5a2.12 2.12 0 0 1 3 3L19 8",
    user: "M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    "user-add": "M2 21v-2a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v2M12 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0M19 8v8m-4-4h8",
    archive: "M4 9v11h16V9M3 4h18v5H3zM9 13h6",
    trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
    search: "m21 21-4.5-4.5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    filter: "M3 4h18l-7 8v6l-4 2v-8z",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21a2 2 0 0 0 4 0",
    paperclip: "m9 15 7-7a3 3 0 0 0-4-4l-8 8a5 5 0 0 0 7 7l8-8m-2-5-8 8a1 1 0 0 0 2 2l7-7",
    "document-add": "M6 3h8l4 4v14H6zM14 3v5h4M12 11v7m-3.5-3.5h7",
    plus: "M12 5v14M5 12h14",
    arrow: "m9 18 6-6-6-6",
    check: "m5 12 4 4L19 6",
    clock: "M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    refresh: "M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6",
    reports: "M4 3h16v18H4zM8 15v3M12 11v7M16 7v11",
    download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
    "login-monitor": "M3 4h18v13H3zM1 21h22m-11-4v4",
    "login-ticket": "m3 12 9-9h6v3a2 2 0 0 0 3 2v5l-9 9-3-3a2 2 0 0 0-3-3zm9-5 1.5 1.5m1.5 1.5 1.5 1.5",
    "login-bars": "M2 13h4v8H2zm8-5h4v13h-4zm8-6h4v19h-4z",
    "login-headset": "M3 13v-2a9 9 0 0 1 18 0v3m-18-2H2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3v-6H3Zm18 0h1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-3v-6h2Zm0 6a4 4 0 0 1-4 4h-4",
    "login-mail": "M3 5h18v14H3zM3 6l9 7 9-7",
    "login-lock": "M6 10h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Zm2 0V7a4 4 0 1 1 8 0v3m-4 5v2",
    "login-eye": "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
    "login-eye-off": "m3 3 18 18M10 6.2a11 11 0 0 1 2-.2c6.5 0 10 6 10 6a17 17 0 0 1-3.2 3.5M6 8.3A17 17 0 0 0 2 12s3.5 6 10 6c1.3 0 2.6-.3 3.7-.7M10 10a3 3 0 0 0 4 4",
    "login-enter": "M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5M2 12h12m-5-5 5 5-5 5",
    "login-shield": "M12 22S4 18 4 11V5l8-3 8 3v6c0 7-8 11-8 11Zm-4-10 3 3 5-6",
    "sidebar-power": "M12 2v9M7 5a9 9 0 1 0 10 0",
    "sidebar-wrench": "M21 3a6 6 0 0 1-7.4 8.6l-8 8a2 2 0 0 1-2.8-2.8l8-8A6 6 0 0 1 19 2l-4 4 3 3 4-4Z",
    "shell-home": "m2 11 10-9 10 9M5 9v12h5v-7h4v7h5V9",
    "dashboard-filter": "M3 4h18l-7 8v6l-4 2v-8z",
    "dashboard-trend": "m3 17 6-6 4 4 8-9m-5 0h5v5",
  }
  return <svg className="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.clipboard} /></svg>
}

export function Badge({ children }: { children: string }) {
  const color = ["Cerrado", "Habilitado", "Activa"].includes(children) ? "green" : children === "Pendiente" ? "amber" : children === "Alta" ? "red" : children === "En revisión" || children === "Media" ? "blue" : "slate"
  return <span className={`badge ${color}`}>{children}</span>
}

export function VerIncidencia({ codigo, abrir }: { codigo: string; abrir: () => void }) {
  const etiqueta = `Ver detalle de ${codigo}`
  return <button type="button" className="row-action incident-view-action" aria-label={etiqueta} title={etiqueta} onClick={abrir}>
    <Icon name="login-eye" />
  </button>
}

export function BannerInstitucional({ titulo, descripcion, icono }: { titulo: string; descripcion: string; icono: string }) {
  return <section className="real-shell-greeting incident-hero">
    <div><h2>{titulo}</h2><p>{descripcion}</p></div>
    <div className="real-dashboard-banner-art" aria-hidden="true"><span className="banner-topic-icon"><Icon name={icono} /></span></div>
  </section>
}
