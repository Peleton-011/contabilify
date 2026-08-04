// Configuración de moneda: cambia estos dos valores según tu país/moneda.
// (No se asumió una moneda específica ya que el esquema es adaptable.)
const LOCALE_MONEDA = 'es-ES'
const CODIGO_MONEDA = 'EUR'

const FORMATEADOR_MONTO = new Intl.NumberFormat(LOCALE_MONEDA, {
  style: 'currency',
  currency: CODIGO_MONEDA,
  minimumFractionDigits: 2,
})

export function formatoMonto(monto: number): string {
  return FORMATEADOR_MONTO.format(monto)
}

/**
 * Convierte un monto escrito a mano a número. Acepta tanto coma decimal
 * (convención española: "1.234,56") como punto decimal ("1234.56"), para
 * no depender de que el navegador entienda la coma como separador.
 * Devuelve NaN si el texto no se puede interpretar como número.
 */
export function parseMonto(texto: string): number {
  const limpio = texto.trim()
  if (!limpio) return NaN

  const normalizado = limpio.includes(',')
    ? limpio.replace(/\./g, '').replace(',', '.')
    : limpio

  return Number(normalizado)
}
