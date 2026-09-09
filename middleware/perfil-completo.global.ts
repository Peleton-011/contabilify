// Si el usuario ya tiene sesión pero todavía no completó su perfil (recién
// invitado, sin nombre ni contraseña propia), lo mandamos a /perfil antes de
// dejarlo usar el resto de la app. Una vez el perfil está completo, también
// exige que tenga un ledger activo (si no pertenece a ninguno todavía, lo
// manda a /ledgers a crear uno). Va todo en un solo middleware global (en
// vez de uno nuevo) para no depender del orden alfabético entre archivos
// *.global.ts, que es el orden en que Nuxt los ejecuta.
const RUTAS_EXCLUIDAS = ['/login', '/confirm', '/actualizar-password', '/perfil', '/ledgers']

export default defineNuxtRouteMiddleware(async (to) => {
  if (RUTAS_EXCLUIDAS.includes(to.path)) return

  const user = useSupabaseUser()
  if (!user.value) return // el middleware de @nuxtjs/supabase ya maneja este caso

  const { profile, perfilCompleto, fetchProfile } = useProfile()
  if (!profile.value) await fetchProfile()

  if (profile.value && !perfilCompleto.value) {
    return navigateTo('/perfil')
  }

  const { ledgers, fetchLedgers, asegurarLedgerActivo } = useLedgers()
  if (!ledgers.value.length) await fetchLedgers()
  asegurarLedgerActivo()

  if (!ledgers.value.length) {
    return navigateTo('/ledgers')
  }
})
