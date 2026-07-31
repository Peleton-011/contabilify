import type { Database } from '~/types/database'
import type { Cuenta } from '~/types/schema'

export function useCuentas() {
  const supabase = useSupabaseClient<Database>()
  const cuentas = useState<Cuenta[]>('cuentas', () => [])
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function fetchCuentas(soloActivas = true) {
    pending.value = true
    error.value = null
    let query = supabase.from('cuentas').select('*').order('orden', { ascending: true })
    if (soloActivas) query = query.eq('activa', true)

    const { data, error: err } = await query
    if (err) error.value = err.message
    else cuentas.value = (data ?? []) as Cuenta[]
    pending.value = false
  }

  async function crearCuenta(input: Pick<Cuenta, 'nombre' | 'tipo'> & Partial<Cuenta>) {
    const { data, error: err } = await supabase.from('cuentas').insert(input).select().single()
    if (err) throw err
    await fetchCuentas(false)
    return data as Cuenta
  }

  async function actualizarCuenta(id: string, changes: Partial<Cuenta>) {
    const { error: err } = await supabase.from('cuentas').update(changes).eq('id', id)
    if (err) throw err
    await fetchCuentas(false)
  }

  async function eliminarCuenta(id: string) {
    const { error: err } = await supabase.from('cuentas').delete().eq('id', id)
    if (err) throw err
    await fetchCuentas(false)
  }

  return { cuentas, pending, error, fetchCuentas, crearCuenta, actualizarCuenta, eliminarCuenta }
}
