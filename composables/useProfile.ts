import type { Database } from '~/types/database'
import type { Profile } from '~/types/schema'

export function useProfile() {
  const user = useSupabaseUser()
  const supabase = useSupabaseClient<Database>()
  const profile = useState<Profile | null>('profile', () => null)
  const pending = useState('profile-pending', () => false)

  async function fetchProfile() {
    if (!user.value) {
      profile.value = null
      return
    }
    pending.value = true
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .single()
    if (!error) profile.value = data as Profile
    pending.value = false
  }

  watch(
    user,
    () => {
      fetchProfile()
    },
    { immediate: true }
  )

  const isAdmin = computed(() => profile.value?.role === 'admin')
  const isMember = computed(() => !!profile.value)

  return { profile, isAdmin, isMember, pending, fetchProfile }
}
