import ExcelJS from 'exceljs'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/database'
import {
  construirFilasLedger,
  escribirHojaLedger,
  nombreHojaValido,
  type MovimientoLedger,
} from '~/server/utils/ledgerXlsx'

// Exporta un rango de fechas como una hoja "año contable", con el mismo
// formato general que la planilla histórica de la asociación.
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'No autorizado' })
  }

  const supabase = await serverSupabaseClient<Database>(event)
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Solo un administrador puede exportar' })
  }

  const query = getQuery(event)
  const desde = String(query.desde ?? '')
  const hasta = String(query.hasta ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || desde > hasta) {
    throw createError({ statusCode: 400, statusMessage: 'Rango de fechas inválido' })
  }

  const { data: cuentasData, error: errCuentas } = await supabase
    .from('cuentas')
    .select('id, nombre, saldo_inicial, activa, orden')
    .order('orden', { ascending: true })
  if (errCuentas) throw createError({ statusCode: 500, statusMessage: errCuentas.message })
  const cuentas = (cuentasData ?? []).filter((c) => c.activa)

  const { data: previos, error: errPrevios } = await supabase
    .from('movimientos')
    .select('cuenta_id, tipo, monto')
    .lt('fecha', desde)
  if (errPrevios) throw createError({ statusCode: 500, statusMessage: errPrevios.message })

  const saldoInicialPorCuenta: Record<string, number> = {}
  for (const c of cuentas) saldoInicialPorCuenta[c.id] = c.saldo_inicial
  for (const m of previos ?? []) {
    if (!(m.cuenta_id in saldoInicialPorCuenta)) continue
    saldoInicialPorCuenta[m.cuenta_id] += m.tipo === 'ingreso' ? m.monto : -m.monto
  }

  const { data: movsData, error: errMovs } = await supabase
    .from('movimientos')
    .select(
      'id, fecha, tipo, monto, concepto, numero_factura, cuenta_id, created_at, metadata, entidad:entidades(nombre), cuenta:cuentas(nombre)'
    )
    .gte('fecha', desde)
    .lte('fecha', hasta)
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
  const movs = (movsData ?? []) as unknown as FilaMovimientoJoin[]

  const movimientosLedger: MovimientoLedger[] = movs.map((m) => ({
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

  const filas = construirFilasLedger(
    movimientosLedger,
    cuentas.map((c) => c.id)
  )

  const esAnioCompleto = desde.endsWith('-01-01') && hasta.endsWith('-12-31') && desde.slice(0, 4) === hasta.slice(0, 4)
  const nombreHoja = nombreHojaValido(esAnioCompleto ? desde.slice(0, 4) : `${desde}_a_${hasta}`)

  const workbook = new ExcelJS.Workbook()
  escribirHojaLedger(
    workbook,
    nombreHoja,
    cuentas.map((c) => ({ id: c.id, nombre: c.nombre })),
    filas,
    saldoInicialPorCuenta,
    esAnioCompleto ? 'Saldo inicio de ejercicio' : 'Saldo inicial del periodo'
  )

  const buffer = await workbook.xlsx.writeBuffer()

  setHeader(
    event,
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  setHeader(event, 'Content-Disposition', `attachment; filename="movimientos-${nombreHoja}.xlsx"`)
  return buffer
})
