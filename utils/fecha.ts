// Utilidades de fecha para el modo de carga rápida.
// Formato canónico interno y de base de datos: yyyy-mm-dd

const PATRON_FECHA = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/

export function hoyISO(): string {
  const ahora = new Date()
  const offset = ahora.getTimezoneOffset()
  const local = new Date(ahora.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 10)
}

/**
 * Acepta yyyy-mm-dd o yyyy/mm/dd y devuelve siempre yyyy-mm-dd.
 * Devuelve null si el texto no es una fecha válida.
 */
export function normalizarFecha(texto: string): string | null {
  const match = texto.trim().match(PATRON_FECHA)
  if (!match) return null

  const [, anio, mes, dia] = match
  const a = Number(anio)
  const m = Number(mes)
  const d = Number(dia)

  if (m < 1 || m > 12 || d < 1 || d > 31) return null

  const fecha = new Date(Date.UTC(a, m - 1, d))
  if (fecha.getUTCFullYear() !== a || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) {
    return null
  }

  return `${anio}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function sumarDias(fechaISO: string, delta: number): string {
  const [a, m, d] = fechaISO.split('-').map(Number)
  const fecha = new Date(Date.UTC(a, m - 1, d))
  fecha.setUTCDate(fecha.getUTCDate() + delta)
  return fecha.toISOString().slice(0, 10)
}

const FORMATEADOR_LEGIBLE = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function formatoFechaLegible(fechaISO: string): string {
  const [a, m, d] = fechaISO.split('-').map(Number)
  if (!a || !m || !d) return fechaISO
  const fecha = new Date(Date.UTC(a, m - 1, d))
  return FORMATEADOR_LEGIBLE.format(fecha)
}
