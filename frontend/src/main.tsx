
import React from "react"
import ReactDOM from "react-dom/client"

import App from "./App"
import RealApp from "./RealApp"

import "./index.css"

// El prototipo permanece disponible por defecto.
// Solo se activa el acceso real con una configuracion explicita.
const modoReal = import.meta.env.VITE_MODO_REAL === "true"

const Aplicacion = modoReal ? RealApp : App

ReactDOM.createRoot(
  document.getElementById("root")!,
).render(
  <React.StrictMode>
    <Aplicacion />
  </React.StrictMode>,
)
