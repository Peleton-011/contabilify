// Configuración de moneda: cambiá estos dos valores según tu país/moneda.
// (No se asumió una moneda específica ya que el esquema es adaptable.)
const LOCALE_MONEDA = 'es-AR'
const CODIGO_MONEDA = 'ARS'

const FORMATEADOR_MONTO = new Intl.NumberFormat(LOCALE_MONEDA, {
  style: 'currency',
  currency: CODIGO_MONEDA,
  minimumFractionDigits: 2,
})

export function formatoMonto(monto: number): string {
  return FORMATEADOR_MONTO.format(monto)
}
