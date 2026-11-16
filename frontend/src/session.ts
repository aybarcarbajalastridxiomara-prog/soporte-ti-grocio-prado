/** Sesión exclusivamente en memoria. Nunca se persisten ni se registran tokens. */
export type SesionReal = {
  access_token: string
  refresh_token: string
  expires_in: number
}

export class SesionExpirada extends Error {
  constructor() { super("La sesión terminó. Inicia sesión nuevamente.") }
}

export class GestorSesion {
  private sesion: SesionReal | null = null
  private vence = 0
  private generacion = 0
  private tokens = new Set<string>()
  private renovacion: Promise<string> | null = null
  alExpirar: (() => void) | null = null

  constructor(private renovarToken: (refresh: string) => Promise<SesionReal>) {}

  establecer(sesion: SesionReal) {
    this.limpiar()
    this.guardar(sesion)
  }

  private guardar(sesion: SesionReal) {
    this.sesion = sesion
    this.tokens.add(sesion.access_token)
    this.vence = Date.now() + sesion.expires_in * 1000
  }

  limpiar() {
    this.generacion++
    this.sesion = null
    this.tokens.clear()
    this.renovacion = null
    this.vence = 0
  }

  expirar(): never {
    this.limpiar()
    this.alExpirar?.()
    throw new SesionExpirada()
  }

  private validar(token: string) {
    if (!this.sesion || !this.tokens.has(token)) throw new SesionExpirada()
    return this.sesion
  }

  esSesionActual(token: string): boolean {
    return this.sesion !== null && this.tokens.has(token)
  }

  async obtenerToken(token: string): Promise<string> {
    const sesion = this.validar(token)
    if (Date.now() >= this.vence - 60000) return this.renovar(sesion.access_token)
    return sesion.access_token
  }

  renovar(token: string): Promise<string> {
    const sesion = this.validar(token)
    // Otra petición ya renovó el token que recibió un 401.
    if (token !== sesion.access_token) return Promise.resolve(sesion.access_token)
    if (this.renovacion) return this.renovacion
    const generacion = this.generacion
    const promesa = (async () => {
      try {
        const nueva = await this.renovarToken(sesion.refresh_token)
        if (generacion !== this.generacion) throw new SesionExpirada()
        this.guardar(nueva)
        return nueva.access_token
      } catch (error) {
        if (generacion === this.generacion && error instanceof SesionExpirada) this.expirar()
        throw error
      } finally {
        if (generacion === this.generacion) this.renovacion = null
      }
    })()
    this.renovacion = promesa
    return promesa
  }
}
