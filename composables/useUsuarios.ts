import type { Database } from '~/types/database'
import type { Profile } from '~/types/schema'

export function useUsuarios() {
  const supabase = useSupabaseClient<Database>()
  const usuarios = useState<Profile[]>('usuarios', () => [])
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function fetchUsuarios() {
    pending.value = true
    error.value = null
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    if (err) error.value = err.message
    else usuarios.value = (data ?? []) as Profile[]
    pending.value = false
  }

  async function cambiarRol(id: string, role: Profile['role']) {
    const { error: err } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (err) throw err
    await fetchUsuarios()
  }

  return { usuarios, pending, error, fetchUsuarios, cambiarRol }
}
