export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    clipboard: "M9 3h6l1 2h3v16H5V5h3zM9 11h6M9 15h6",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    tool: "m14.7 6.3 3 3L7 20H4v-3L14.7 6.3ZM16 5l1.5-1.5a2.12 2.12 0 0 1 3 3L19 8",
    user: "M20 21a8 8 0 0 0-16 0M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    search: "m21 21-4.5-4.5M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    plus: "M12 5v14M5 12h14",
    arrow: "m9 18 6-6-6-6",
    check: "m5 12 4 4L19 6",
    clock: "M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    refresh: "M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6",
  }
  return <svg className="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name] || paths.clipboard} /></svg>
}

export function Badge({ children }: { children: string }) {
  const color = ["Cerrado", "Habilitado", "Activa"].includes(children) ? "green" : children === "Pendiente" ? "amber" : children === "Alta" ? "red" : children === "En revisión" || children === "Media" ? "blue" : "slate"
  return <span className={`badge ${color}`}>{children}</span>
}
