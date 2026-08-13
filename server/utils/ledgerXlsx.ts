import type ExcelJS from 'exceljs'

// ============================================================================
// Generador de hojas "año contable" en Excel, con el mismo formato general
// que la planilla histórica de la asociación (bloques Egresos/Ingresos/Saldo
// por cuenta + un bloque "Conjunto" con el total), pero con fórmulas de saldo
// simples y consistentes (sin los errores #REF! ni las fórmulas de matriz
// que aparecían en los años más recientes del archivo original).
// ============================================================================

export const COLUMNAS_FIJAS = 4 // Fecha, Proveedor, Concepto, Nº factura
export const COLUMNAS_POR_CUENTA = 3 // Egresos, Ingresos, Saldo

export interface CuentaLedger {
  id: string
  nombre: string
}

export interface MovimientoLedger {
  id: string
  fecha: string // yyyy-mm-dd
  tipo: 'ingreso' | 'egreso'
  monto: number
  concepto: string
  numero_factura: string | null
  entidad_nombre: string | null
  cuenta_id: string
  cuenta_nombre: string
  created_at: string
  transferencia_id: string | null
}

export interface FilaLedger {
  fecha: string
  proveedor: string
  concepto: string
  numeroFactura: string
  porCuenta: Record<string, { egreso: number; ingreso: number }>
}

/**
 * Agrupa movimientos en filas de planilla: una fila por movimiento, salvo las
 * transferencias entre cuentas propias (mismo `transferencia_id`), que se
 * combinan en una sola fila con el egreso en la cuenta de origen y el
 * ingreso en la de destino — igual que cualquier otra fila, sin necesitar la
 * convención de "ingreso negativo" que usaba la planilla original.
 */
export function construirFilasLedger(
  movimientos: MovimientoLedger[],
  cuentaIds: string[]
): FilaLedger[] {
  const ordenados = [...movimientos].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1
    return a.created_at.localeCompare(b.created_at)
  })

  const porTransferencia = new Map<string, MovimientoLedger[]>()
  for (const m of ordenados) {
    if (!m.transferencia_id) continue
    const lista = porTransferencia.get(m.transferencia_id) ?? []
    lista.push(m)
    porTransferencia.set(m.transferencia_id, lista)
  }

  const vistos = new Set<string>()
  const filas: FilaLedger[] = []

  function filaVacia(): FilaLedger['porCuenta'] {
    const porCuenta: FilaLedger['porCuenta'] = {}
    for (const id of cuentaIds) porCuenta[id] = { egreso: 0, ingreso: 0 }
    return porCuenta
  }

  for (const m of ordenados) {
    if (vistos.has(m.id)) continue

    if (m.transferencia_id) {
      const patas = porTransferencia.get(m.transferencia_id) ?? [m]
      const porCuenta = filaVacia()
      for (const pata of patas) {
        vistos.add(pata.id)
        if (!porCuenta[pata.cuenta_id]) continue
        if (pata.tipo === 'egreso') porCuenta[pata.cuenta_id].egreso += pata.monto
        else porCuenta[pata.cuenta_id].ingreso += pata.monto
      }
      filas.push({
        fecha: m.fecha,
        proveedor: '',
        concepto: m.concepto,
        numeroFactura: '',
        porCuenta,
      })
    } else {
      vistos.add(m.id)
      const porCuenta = filaVacia()
      if (porCuenta[m.cuenta_id]) {
        if (m.tipo === 'egreso') porCuenta[m.cuenta_id].egreso += m.monto
        else porCuenta[m.cuenta_id].ingreso += m.monto
      }
      filas.push({
        fecha: m.fecha,
        proveedor: m.entidad_nombre ?? '',
        concepto: m.concepto,
        numeroFactura: m.numero_factura ?? '',
        porCuenta,
      })
    }
  }

  return filas
}

export function numeroAColumna(num: number): string {
  let letra = ''
  let n = num
  while (n > 0) {
    const resto = (n - 1) % 26
    letra = String.fromCharCode(65 + resto) + letra
    n = Math.floor((n - 1) / 26)
  }
  return letra
}

export function fechaISOaDate(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

const FMT_MONTO = '#,##0.00'

function estiloCabecera(cell: ExcelJS.Cell) {
  cell.font = { bold: true, name: 'Arial', size: 10 }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E3D8' } }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } }
}

/**
 * Escribe una hoja "año contable" completa (cabeceras agrupadas, saldo
 * inicial, una fila por movimiento con fórmulas de saldo, y una fila de
 * totales) en el workbook dado, con el nombre indicado.
 */
export function escribirHojaLedger(
  workbook: ExcelJS.Workbook,
  nombreHoja: string,
  cuentas: CuentaLedger[],
  filas: FilaLedger[],
  saldoInicialPorCuenta: Record<string, number>,
  etiquetaSaldoInicial = 'Saldo inicial del periodo'
): ExcelJS.Worksheet {
  const ws = workbook.addWorksheet(nombreHoja)

  const inicioCuentaCol: Record<string, number> = {}
  let col = COLUMNAS_FIJAS + 1
  for (const cuenta of cuentas) {
    inicioCuentaCol[cuenta.id] = col
    col += COLUMNAS_POR_CUENTA
  }
  const conjuntoCol = col
  const ultimaCol = conjuntoCol + COLUMNAS_POR_CUENTA - 1

  // --- Cabeceras (dos filas: grupo + Egresos/Ingresos/Saldo) ---
  const etiquetasFijas = ['Fecha', 'Proveedor', 'Concepto', 'Nº factura']
  etiquetasFijas.forEach((texto, i) => {
    ws.mergeCells(1, i + 1, 2, i + 1)
    ws.getCell(1, i + 1).value = texto
  })

  for (const cuenta of cuentas) {
    const c = inicioCuentaCol[cuenta.id]
    ws.mergeCells(1, c, 1, c + 2)
    ws.getCell(1, c).value = cuenta.nombre
    ws.getCell(2, c).value = 'Egresos'
    ws.getCell(2, c + 1).value = 'Ingresos'
    ws.getCell(2, c + 2).value = 'Saldo'
  }
  ws.mergeCells(1, conjuntoCol, 1, conjuntoCol + 2)
  ws.getCell(1, conjuntoCol).value = 'Conjunto'
  ws.getCell(2, conjuntoCol).value = 'Egresos'
  ws.getCell(2, conjuntoCol + 1).value = 'Ingresos'
  ws.getCell(2, conjuntoCol + 2).value = 'Saldo'

  for (let r = 1; r <= 2; r++) {
    for (let c = 1; c <= ultimaCol; c++) {
      estiloCabecera(ws.getCell(r, c))
    }
  }

  // --- Fila 3: saldo inicial ---
  const filaSaldoInicial = 3
  ws.getCell(filaSaldoInicial, 3).value = etiquetaSaldoInicial
  ws.getCell(filaSaldoInicial, 3).font = { italic: true, name: 'Arial', size: 10 }
  for (const cuenta of cuentas) {
    const c = inicioCuentaCol[cuenta.id]
    const saldo = saldoInicialPorCuenta[cuenta.id] ?? 0
    ws.getCell(filaSaldoInicial, c + 2).value = saldo
    ws.getCell(filaSaldoInicial, c + 2).numFmt = FMT_MONTO
  }
  const sumaInicial = cuentas.reduce((acc, c) => acc + (saldoInicialPorCuenta[c.id] ?? 0), 0)
  const refsSaldoInicial = cuentas
    .map((c) => `${numeroAColumna(inicioCuentaCol[c.id] + 2)}${filaSaldoInicial}`)
    .join('+')
  ws.getCell(filaSaldoInicial, conjuntoCol + 2).value = refsSaldoInicial
    ? { formula: refsSaldoInicial, result: sumaInicial }
    : sumaInicial
  ws.getCell(filaSaldoInicial, conjuntoCol + 2).numFmt = FMT_MONTO

  // --- Filas de datos ---
  let fila = filaSaldoInicial + 1
  const primeraFilaDatos = fila
  // saldo corriente en JS para poder rellenar `result` en cada fórmula
  const saldoCorriente: Record<string, number> = { ...saldoInicialPorCuenta }
  let conjuntoCorriente = sumaInicial

  for (const f of filas) {
    ws.getCell(fila, 1).value = fechaISOaDate(f.fecha)
    ws.getCell(fila, 1).numFmt = 'dd/mm/yyyy'
    ws.getCell(fila, 2).value = f.proveedor
    ws.getCell(fila, 3).value = f.concepto
    ws.getCell(fila, 4).value = f.numeroFactura

    let egresoConjunto = 0
    let ingresoConjunto = 0

    for (const cuenta of cuentas) {
      const c = inicioCuentaCol[cuenta.id]
      const datos = f.porCuenta[cuenta.id] ?? { egreso: 0, ingreso: 0 }
      if (datos.egreso) ws.getCell(fila, c).value = datos.egreso
      if (datos.ingreso) ws.getCell(fila, c + 1).value = datos.ingreso
      ws.getCell(fila, c).numFmt = FMT_MONTO
      ws.getCell(fila, c + 1).numFmt = FMT_MONTO

      egresoConjunto += datos.egreso
      ingresoConjunto += datos.ingreso

      const previo = saldoCorriente[cuenta.id] ?? 0
      const nuevoSaldo = previo - datos.egreso + datos.ingreso
      saldoCorriente[cuenta.id] = nuevoSaldo

      const colEgreso = numeroAColumna(c)
      const colIngreso = numeroAColumna(c + 1)
      const colSaldo = numeroAColumna(c + 2)
      ws.getCell(fila, c + 2).value = {
        formula: `${colSaldo}${fila - 1}-${colEgreso}${fila}+${colIngreso}${fila}`,
        result: nuevoSaldo,
      }
      ws.getCell(fila, c + 2).numFmt = FMT_MONTO
    }

    conjuntoCorriente = conjuntoCorriente - egresoConjunto + ingresoConjunto

    const refsEgreso = cuentas.map((c) => `${numeroAColumna(inicioCuentaCol[c.id])}${fila}`).join('+')
    const refsIngreso = cuentas
      .map((c) => `${numeroAColumna(inicioCuentaCol[c.id] + 1)}${fila}`)
      .join('+')
    ws.getCell(fila, conjuntoCol).value = { formula: refsEgreso, result: egresoConjunto }
    ws.getCell(fila, conjuntoCol + 1).value = { formula: refsIngreso, result: ingresoConjunto }
    ws.getCell(fila, conjuntoCol).numFmt = FMT_MONTO
    ws.getCell(fila, conjuntoCol + 1).numFmt = FMT_MONTO

    const colConjuntoSaldo = numeroAColumna(conjuntoCol + 2)
    const colConjuntoEgreso = numeroAColumna(conjuntoCol)
    const colConjuntoIngreso = numeroAColumna(conjuntoCol + 1)
    ws.getCell(fila, conjuntoCol + 2).value = {
      formula: `${colConjuntoSaldo}${fila - 1}-${colConjuntoEgreso}${fila}+${colConjuntoIngreso}${fila}`,
      result: conjuntoCorriente,
    }
    ws.getCell(fila, conjuntoCol + 2).numFmt = FMT_MONTO

    fila++
  }

  // --- Fila de totales ---
  const filaTotal = fila
  ws.getCell(filaTotal, 3).value = 'Total:'
  ws.getCell(filaTotal, 3).font = { bold: true, name: 'Arial', size: 10 }

  const hayDatos = filas.length > 0
  const ultimaFilaDatos = fila - 1

  function totalCuentaColumna(colNum: number): void {
    if (hayDatos) {
      const letra = numeroAColumna(colNum)
      ws.getCell(filaTotal, colNum).value = {
        formula: `SUM(${letra}${primeraFilaDatos}:${letra}${ultimaFilaDatos})`,
      }
    }
    ws.getCell(filaTotal, colNum).numFmt = FMT_MONTO
    ws.getCell(filaTotal, colNum).font = { bold: true, name: 'Arial', size: 10 }
  }

  for (const cuenta of cuentas) {
    const c = inicioCuentaCol[cuenta.id]
    totalCuentaColumna(c)
    totalCuentaColumna(c + 1)
    const letraSaldo = numeroAColumna(c + 2)
    ws.getCell(filaTotal, c + 2).value = { formula: `${letraSaldo}${ultimaFilaDatos}` }
    ws.getCell(filaTotal, c + 2).numFmt = FMT_MONTO
    ws.getCell(filaTotal, c + 2).font = { bold: true, name: 'Arial', size: 10 }
  }
  totalCuentaColumna(conjuntoCol)
  totalCuentaColumna(conjuntoCol + 1)
  const letraConjuntoSaldo = numeroAColumna(conjuntoCol + 2)
  ws.getCell(filaTotal, conjuntoCol + 2).value = { formula: `${letraConjuntoSaldo}${ultimaFilaDatos}` }
  ws.getCell(filaTotal, conjuntoCol + 2).numFmt = FMT_MONTO
  ws.getCell(filaTotal, conjuntoCol + 2).font = { bold: true, name: 'Arial', size: 10 }

  // --- Anchos de columna ---
  ws.getColumn(1).width = 12
  ws.getColumn(2).width = 28
  ws.getColumn(3).width = 32
  ws.getColumn(4).width = 16
  for (let c = COLUMNAS_FIJAS + 1; c <= ultimaCol; c++) {
    ws.getColumn(c).width = 13
  }

  ws.views = [{ state: 'frozen', xSplit: COLUMNAS_FIJAS, ySplit: 2 }]

  return ws
}

/** Huella para detectar si un movimiento ya está representado en una hoja. */
export function huellaMovimiento(datos: {
  fecha: string
  cuentaNombre: string
  tipo: 'ingreso' | 'egreso'
  monto: number
}): string {
  const centavos = Math.round(datos.monto * 100)
  return `${datos.fecha}|${datos.cuentaNombre.trim().toLowerCase()}|${datos.tipo}|${centavos}`
}

export function nombreHojaValido(nombre: string): string {
  return nombre.replace(/[\\/?*[\]:]/g, '-').slice(0, 31)
}

// ============================================================================
// Lectura de hojas "año contable" existentes (para sincronizar.post.ts): dado
// un archivo subido por el usuario, detectar qué columnas corresponden a cada
// cuenta y extraer las huellas de los movimientos ya representados.
// ============================================================================

/**
 * Detecta, en una hoja "año contable" (fila 1 = grupos por cuenta, fila 2 =
 * Egresos/Ingresos/Saldo), qué columnas corresponden a Fecha y a cada cuenta
 * conocida. La coincidencia de cuenta es por substring (case-insensitive)
 * porque la planilla histórica usa etiquetas como "Caja, Efectivo" en vez
 * del nombre exacto de la cuenta ("Caja").
 */
export function detectarColumnas(ws: ExcelJS.Worksheet, cuentas: CuentaLedger[]) {
  const colCuentaActual: (string | null)[] = []
  let actual: string | null = null
  const filaGrupos = ws.getRow(1)
  const maxColHoja = ws.actualColumnCount || ws.columnCount || 40

  // Algunas hojas (2023, 2025) tienen, a la derecha del bloque "Conjunto",
  // recuadros sueltos de eventos (Balance Fiestas, etc.) que repiten el
  // nombre de una cuenta ("Caja, Efectivo") en su propia cabecera. Como esos
  // recuadros no son parte de la tabla principal, se ignora todo lo que
  // aparezca después del bloque "Conjunto".
  let maxCol = maxColHoja
  for (let c = 1; c <= maxColHoja; c++) {
    const valor = filaGrupos.getCell(c).value
    if (typeof valor === 'string' && valor.trim().toLowerCase().includes('conjunto')) {
      maxCol = c
    }
  }

  for (let c = 1; c <= maxCol; c++) {
    const valor = filaGrupos.getCell(c).value
    if (typeof valor === 'string' && valor.trim()) {
      const texto = valor.trim().toLowerCase()
      const encontrada = cuentas.find((cta) => texto.includes(cta.nombre.trim().toLowerCase()))
      actual = encontrada ? encontrada.id : texto.includes('conjunto') ? '__conjunto__' : null
    }
    colCuentaActual[c] = actual
  }

  const filaSub = ws.getRow(2)
  let colFecha: number | null = null
  const columnas: Record<string, { egreso?: number; ingreso?: number }> = {}

  for (let c = 1; c <= maxCol; c++) {
    const valor = filaSub.getCell(c).value
    const texto = typeof valor === 'string' ? valor.trim().toLowerCase() : ''
    if (texto === 'fecha') colFecha = c
    const cuentaId = colCuentaActual[c]
    if (!cuentaId || cuentaId === '__conjunto__') continue
    if (!columnas[cuentaId]) columnas[cuentaId] = {}
    if (texto === 'egresos') columnas[cuentaId].egreso = c
    else if (texto === 'ingresos') columnas[cuentaId].ingreso = c
  }

  return { colFecha, columnas }
}

export function celdaANumero(valor: ExcelJS.CellValue): number {
  if (typeof valor === 'number') return valor
  if (valor && typeof valor === 'object' && 'result' in valor) {
    const r = (valor as { result?: unknown }).result
    if (typeof r === 'number') return r
  }
  return 0
}

export function celdaAFechaISO(valor: ExcelJS.CellValue): string | null {
  if (valor instanceof Date) {
    const y = valor.getUTCFullYear()
    const m = String(valor.getUTCMonth() + 1).padStart(2, '0')
    const d = String(valor.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return null
}

/** Extrae las huellas de movimientos ya representados en una hoja "año contable". */
export function huellasDeHoja(ws: ExcelJS.Worksheet, cuentas: CuentaLedger[]): Set<string> {
  const { colFecha, columnas } = detectarColumnas(ws, cuentas)
  const huellas = new Set<string>()
  if (!colFecha) return huellas

  const nombrePorId = new Map(cuentas.map((c) => [c.id, c.nombre]))

  ws.eachRow((row, numeroFila) => {
    if (numeroFila <= 2) return
    const fecha = celdaAFechaISO(row.getCell(colFecha).value)
    if (!fecha) return

    for (const [cuentaId, cols] of Object.entries(columnas)) {
      const nombreCuenta = nombrePorId.get(cuentaId)
      if (!nombreCuenta) continue
      if (cols.egreso) {
        const monto = celdaANumero(row.getCell(cols.egreso).value)
        if (monto > 0) huellas.add(huellaMovimiento({ fecha, cuentaNombre: nombreCuenta, tipo: 'egreso', monto }))
      }
      if (cols.ingreso) {
        const monto = celdaANumero(row.getCell(cols.ingreso).value)
        if (monto > 0) huellas.add(huellaMovimiento({ fecha, cuentaNombre: nombreCuenta, tipo: 'ingreso', monto }))
      }
    }
  })

  return huellas
}
