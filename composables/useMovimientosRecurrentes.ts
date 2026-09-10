import type { Database } from '~/types/database'
import type { MovimientoRecurrenteConRelaciones, NuevoMovimientoRecurrente } from '~/types/schema'

const SELECT_CON_RELACIONES = '*, entidad:entidades(id, nombre), cuenta:cuentas(id, nombre, tipo)'

export type MovimientoRecurrenteDesactualizado = {
  movimiento_id: string
  ledger_id: string
  fecha: string
  recurrente_id: string
}

export function useMovimientosRecurrentes() {
  const supabase = useSupabaseClient<Database>()
  const reglas = useState<MovimientoRecurrenteConRelaciones[]>('movimientos-recurrentes', () => [])
  const desactualizados = useState<MovimientoRecurrenteDesactualizado[]>(
    'movimientos-recurrentes-desactualizados',
    () => []
  )
  const pending = ref(false)
  const error = ref<string | null>(null)
  const { ledgerActivoId } = useLedgerActivo()

  async function fetchReglas() {
    if (!ledgerActivoId.value) {
      reglas.value = []
      return
    }
    pending.value = true
    error.value = null

    const { data, error: err } = await supabase
      .from('movimientos_recurrentes')
      .select(SELECT_CON_RELACIONES)
      .eq('ledger_id', ledgerActivoId.value)
      .order('created_at', { ascending: true })

    if (err) error.value = err.message
    else reglas.value = (data ?? []) as unknown as MovimientoRecurrenteConRelaciones[]
    pending.value = false
  }

  async function crearRegla(input: Omit<NuevoMovimientoRecurrente, 'ledger_id'>) {
    if (!ledgerActivoId.value) throw new Error('No hay un ledger activo')
    const { data, error: err } = await supabase
      .from('movimientos_recurrentes')
      .insert({ ...input, ledger_id: ledgerActivoId.value })
      .select(SELECT_CON_RELACIONES)
      .single()
    if (err) throw err
    await fetchReglas()
    return data as unknown as MovimientoRecurrenteConRelaciones
  }

  async function actualizarRegla(id: string, changes: Partial<NuevoMovimientoRecurrente>) {
    const { error: err } = await supabase.from('movimientos_recurrentes').update(changes).eq('id', id)
    if (err) throw err
    await fetchReglas()
  }

  async function eliminarRegla(id: string) {
    const { error: err } = await supabase.from('movimientos_recurrentes').delete().eq('id', id)
    if (err) throw err
    await fetchReglas()
  }

  // Genera (de forma perezosa) los movimientos que falten hasta hoy para
  // cada regla activa del ledger. Se llama antes de mostrar saldos o
  // movimientos, así una sesión siempre pone al día lo pendiente al abrir
  // la app, sin necesidad de un cron.
  async function materializarPendientes() {
    if (!ledgerActivoId.value) return 0
    const { data, error: err } = await supabase.rpc('materializar_movimientos_recurrentes', {
      p_ledger_id: ledgerActivoId.value,
    })
    if (err) throw err
    return data ?? 0
  }

  // Movimientos generados cuyo período incluye una carga posterior: el
  // cálculo pudo quedar desactualizado. No se recalcula solo (ver la
  // vista); esto es para mostrarlo y que un admin decida.
  async function fetchDesactualizados() {
    if (!ledgerActivoId.value) {
      desactualizados.value = []
      return
    }
    const { data, error: err } = await supabase
      .from('movimientos_recurrentes_desactualizados')
      .select('*')
      .eq('ledger_id', ledgerActivoId.value)
    if (!err) desactualizados.value = data ?? []
  }

  return {
    reglas,
    desactualizados,
    pending,
    error,
    fetchReglas,
    crearRegla,
    actualizarRegla,
    eliminarRegla,
    materializarPendientes,
    fetchDesactualizados,
  }
}
