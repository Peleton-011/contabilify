import type { Database } from '~/types/database'
import type { SaldoCuenta } from '~/types/schema'

export function useSaldos() {
  const supabase = useSupabaseClient<Database>()
  const saldos = useState<SaldoCuenta[]>('saldos', () => [])
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function fetchSaldos() {
    pending.value = true
    error.value = null
    const { data, error: err } = await supabase
      .from('saldos_cuentas')
      .select('*')
      .order('orden', { ascending: true })
    if (err) error.value = err.message
    else saldos.value = (data ?? []) as SaldoCuenta[]
    pending.value = false
  }

  const saldoTotal = computed(() => saldos.value.reduce((acc, s) => acc + s.saldo_actual, 0))

  return { saldos, saldoTotal, pending, error, fetchSaldos }
}
