import type { Database } from '~/types/database'
import type { MovimientoConRelaciones, NuevoMovimiento, TipoMovimiento } from '~/types/schema'

export interface FiltrosMovimientos {
  desde?: string
  hasta?: string
  tipo?: TipoMovimiento | null
  cuentaId?: string | null
  entidadId?: string | null
  texto?: string
}

const SELECT_CON_RELACIONES = '*, entidad:entidades(id, nombre), cuenta:cuentas(id, nombre, tipo)'

export function useMovimientos() {
  const supabase = useSupabaseClient<Database>()
  const movimientos = useState<MovimientoConRelaciones[]>('movimientos', () => [])
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function fetchMovimientos(filtros: FiltrosMovimientos = {}, limite = 300) {
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
    if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
    if (filtros.cuentaId) query = query.eq('cuenta_id', filtros.cuentaId)
    if (filtros.entidadId) query = query.eq('entidad_id', filtros.entidadId)
    if (filtros.texto) query = query.ilike('concepto', `%${filtros.texto}%`)

    const { data, error: err } = await query
    if (err) error.value = err.message
    else movimientos.value = (data ?? []) as unknown as MovimientoConRelaciones[]
    pending.value = false
  }

  async function crearMovimiento(input: NuevoMovimiento) {
    const { data, error: err } = await supabase
      .from('movimientos')
      .insert(input)
      .select(SELECT_CON_RELACIONES)
      .single()
    if (err) throw err
    return data as unknown as MovimientoConRelaciones
  }

  async function actualizarMovimiento(id: string, changes: Partial<NuevoMovimiento>) {
    const { error: err } = await supabase.from('movimientos').update(changes).eq('id', id)
    if (err) throw err
  }

  async function eliminarMovimiento(id: string) {
    const { error: err } = await supabase.from('movimientos').delete().eq('id', id)
    if (err) throw err
  }

  return {
    movimientos,
    pending,
    error,
    fetchMovimientos,
    crearMovimiento,
    actualizarMovimiento,
    eliminarMovimiento,
  }
}
