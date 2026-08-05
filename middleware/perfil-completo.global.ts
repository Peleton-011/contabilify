// Si el usuario ya tiene sesión pero todavía no completó su perfil (recién
// invitado, sin nombre ni contraseña propia), lo mandamos a /perfil antes de
// dejarlo usar el resto de la app.
const RUTAS_EXCLUIDAS = ['/login', '/confirm', '/actualizar-password', '/perfil']

export default defineNuxtRouteMiddleware(async (to) => {
  if (RUTAS_EXCLUIDAS.includes(to.path)) return

  const user = useSupabaseUser()
  if (!user.value) return // el middleware de @nuxtjs/supabase ya maneja este caso

  const { profile, perfilCompleto, fetchProfile } = useProfile()
  if (!profile.value) await fetchProfile()

  if (profile.value && !perfilCompleto.value) {
    return navigateTo('/perfil')
  }
})
