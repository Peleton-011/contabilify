import type { Database } from '~/types/database'
import type { LedgerMemberConPerfil, Rol } from '~/types/schema'

export function useUsuarios() {
  const supabase = useSupabaseClient<Database>()
  const usuarios = useState<LedgerMemberConPerfil[]>('usuarios', () => [])
  const pending = ref(false)
  const error = ref<string | null>(null)
  const { ledgerActivoId } = useLedgerActivo()

  async function fetchUsuarios() {
    if (!ledgerActivoId.value) {
      usuarios.value = []
      return
    }
    pending.value = true
    error.value = null
    const { data, error: err } = await supabase
      .from('ledger_members')
      .select('ledger_id, user_id, role, created_at, profile:profiles(id, full_name, email)')
      .eq('ledger_id', ledgerActivoId.value)
      .order('created_at', { ascending: true })
    if (err) error.value = err.message
    else usuarios.value = (data ?? []) as unknown as LedgerMemberConPerfil[]
    pending.value = false
  }

  async function cambiarRol(userId: string, role: Rol) {
    if (!ledgerActivoId.value) throw new Error('No hay un ledger activo')
    const { error: err } = await supabase
      .from('ledger_members')
      .update({ role })
      .eq('ledger_id', ledgerActivoId.value)
      .eq('user_id', userId)
    if (err) throw err
    await fetchUsuarios()
  }

  return { usuarios, pending, error, fetchUsuarios, cambiarRol }
}
