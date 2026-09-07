import type { Database } from '~/types/database'
import { type MovimientoConRelaciones, type NuevoMovimiento, type TipoMovimiento } from '~/types/schema'

export interface FiltrosEntradasSalidas {
  desde?: string
  hasta?: string
//   tipo?: TipoMovimiento | null
  cuentaId?: string | null
  entidadId?: string | null
  texto?: string
}

export interface entradasSalidas {
    cuentaId?: string 
    entradas: number
    salidas: number
}

const SELECT_CON_RELACIONES = '*, entidad:entidades(id, nombre), cuenta:cuentas(id, nombre, tipo)'

export function useEntradasSalidas() {
  const supabase = useSupabaseClient<Database>()
  const entradasSalidas = useState<entradasSalidas>('entradasSalidas', () => ({entradas: 0, salidas: 0}))
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function fetchEntradasSalidas(filtros: FiltrosEntradasSalidas = {}, limite = 300) {
    pending.value = true
    error.value = null

    let query = supabase
      .from('movimientos')
      .select(SELECT_CON_RELACIONES)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limite)

    if (filtros.desde) query = query.gte('fecha', filtros.desde)
    if (filtros.hasta) query = query.lte('fecha', filtros.hasta)
    if (filtros.cuentaId) query = query.eq('cuenta_id', filtros.cuentaId)
    if (filtros.entidadId) query = query.eq('entidad_id', filtros.entidadId)
    if (filtros.texto) query = query.ilike('concepto', `%${filtros.texto}%`)

    const { data, error: err } = await query
    if (err) error.value = err.message
    else {
        const movimientos = (data ?? []) as unknown as MovimientoConRelaciones[]
        const entradas = movimientos.filter(m => m.tipo === 'ingreso').reduce((acc, m) => acc + m.monto, 0)
        const salidas = movimientos.filter(m => m.tipo === 'egreso').reduce((acc, m) => acc + m.monto, 0)
        entradasSalidas.value = {cuentaId: filtros.cuentaId ?? undefined, entradas, salidas}
    }
    pending.value = false
  }


  return {
    pending,
    error,
    fetchEntradasSalidas,
    entradasSalidas

  }
}
