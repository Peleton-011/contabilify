import ExcelJS from 'exceljs'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/database'
import {
  construirFilasLedger,
  escribirHojaLedger,
  huellaMovimiento,
  huellasDeHoja,
  type MovimientoLedger,
} from '~/server/utils/ledgerXlsx'

const NOMBRE_HOJA_ANIO = /^\d{4}$/

interface CuentaDb {
  id: string
  nombre: string
  saldo_inicial: number
}

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'No autorizado' })

  const supabase = await serverSupabaseClient<Database>(event)
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Solo un administrador puede sincronizar' })
  }

  const partes = await readMultipartFormData(event)
  const archivo = partes?.find((p) => p.name === 'archivo')
  if (!archivo?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Subí un archivo .xlsx' })
  }

  const workbook = new ExcelJS.Workbook()
  try {
    // El tipado de exceljs es anterior a los genéricos de Buffer en las
    // versiones nuevas de @types/node; en runtime sigue siendo un Buffer común.
    await workbook.xlsx.load(archivo.data as any)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'No se pudo leer el archivo. ¿Es un .xlsx válido?' })
  }

  const { data: cuentasData, error: errCuentas } = await supabase
    .from('cuentas')
    .select('id, nombre, saldo_inicial, orden')
    .order('orden', { ascending: true })
  if (errCuentas) throw createError({ statusCode: 500, statusMessage: errCuentas.message })
  const cuentas: CuentaDb[] = cuentasData ?? []

  // Huellas de todo lo que ya está representado en el archivo subido,
  // recorriendo únicamente las hojas que parecen "año contable" (nombre de
  // 4 dígitos). El resto de las hojas (Plantilla, Control fiestas, etc.) se
  // deja intacto y no se usa para esta comparación.
  const huellasArchivo = new Set<string>()
  for (const ws of workbook.worksheets) {
    if (!NOMBRE_HOJA_ANIO.test(ws.name)) continue
    for (const h of huellasDeHoja(ws, cuentas)) huellasArchivo.add(h)
  }

  const { data: movsData, error: errMovs } = await supabase
    .from('movimientos')
    .select(
      'id, fecha, tipo, monto, concepto, numero_factura, cuenta_id, created_at, metadata, entidad:entidades(nombre), cuenta:cuentas(nombre)'
    )
    .order('fecha', { ascending: true })
  if (errMovs) throw createError({ statusCode: 500, statusMessage: errMovs.message })

  type FilaMovimientoJoin = {
    id: string
    fecha: string
    tipo: 'ingreso' | 'egreso'
    monto: number
    concepto: string
    numero_factura: string | null
    cuenta_id: string
    created_at: string
    metadata: Record<string, unknown>
    entidad: { nombre: string } | null
    cuenta: { nombre: string } | null
  }
  const todosLosMovimientos = (movsData ?? []) as unknown as FilaMovimientoJoin[]
  const nombrePorCuentaId = new Map(cuentas.map((c) => [c.id, c.nombre]))

  const faltantesPorAnio = new Map<string, FilaMovimientoJoin[]>()
  for (const m of todosLosMovimientos) {
    const nombreCuenta = nombrePorCuentaId.get(m.cuenta_id)
    if (!nombreCuenta) continue
    const huella = huellaMovimiento({
      fecha: m.fecha,
      cuentaNombre: nombreCuenta,
      tipo: m.tipo,
      monto: m.monto,
    })
    if (huellasArchivo.has(huella)) continue

    const anio = m.fecha.slice(0, 4)
    const lista = faltantesPorAnio.get(anio) ?? []
    lista.push(m)
    faltantesPorAnio.set(anio, lista)
  }

  let totalAgregados = 0
  for (const anio of faltantesPorAnio.keys()) {
    totalAgregados += faltantesPorAnio.get(anio)?.length ?? 0

    if (workbook.worksheets.some((ws) => ws.name === anio)) {
      workbook.removeWorksheet(anio)
    }

    const movimientosDelAnio = todosLosMovimientos.filter((m) => m.fecha.startsWith(anio))
    const movimientosLedger: MovimientoLedger[] = movimientosDelAnio.map((m) => ({
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo,
      monto: m.monto,
      concepto: m.concepto,
      numero_factura: m.numero_factura,
      entidad_nombre: m.entidad?.nombre ?? null,
      cuenta_id: m.cuenta_id,
      cuenta_nombre: m.cuenta?.nombre ?? '',
      created_at: m.created_at,
      transferencia_id: (m.metadata?.transferencia_id as string | undefined) ?? null,
    }))

    const inicioAnio = `${anio}-01-01`
    const saldoInicialPorCuenta: Record<string, number> = {}
    for (const c of cuentas) saldoInicialPorCuenta[c.id] = c.saldo_inicial
    for (const m of todosLosMovimientos) {
      if (m.fecha >= inicioAnio) break
      if (!(m.cuenta_id in saldoInicialPorCuenta)) continue
      saldoInicialPorCuenta[m.cuenta_id] += m.tipo === 'ingreso' ? m.monto : -m.monto
    }

    const filas = construirFilasLedger(
      movimientosLedger,
      cuentas.map((c) => c.id)
    )

    escribirHojaLedger(
      workbook,
      anio,
      cuentas.map((c) => ({ id: c.id, nombre: c.nombre })),
      filas,
      saldoInicialPorCuenta,
      'Saldo inicio de ejercicio'
    )
  }

  const buffer = await workbook.xlsx.writeBuffer()

  setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'Content-Disposition', 'attachment; filename="cuentas-actualizado.xlsx"')
  setHeader(event, 'X-Movimientos-Agregados', String(totalAgregados))
  setHeader(event, 'Access-Control-Expose-Headers', 'X-Movimientos-Agregados')
  return buffer
})
