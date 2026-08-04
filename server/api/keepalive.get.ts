import { serverSupabaseServiceRole } from '#supabase/server'
import type { Database } from '~/types/database'

// Endpoint para que un cron externo (Vercel Cron, GitHub Actions, etc.)
// mantenga el proyecto de Supabase activo. El plan gratuito de Supabase
// pausa los proyectos tras ~7 días sin actividad; una consulta real y
// periódica evita eso.
//
// Usa la service role key (bypassa RLS) para garantizar que la consulta
// se ejecute con éxito sin depender de una sesión de usuario.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  if (config.cronSecret) {
    const auth = getHeader(event, 'authorization')
    if (auth !== `Bearer ${config.cronSecret}`) {
      throw createError({ statusCode: 401, statusMessage: 'No autorizado' })
    }
  }

  const supabase = serverSupabaseServiceRole<Database>(event)
  const { error } = await supabase.from('cuentas').select('id').limit(1)

  if (error) {
    throw createError({ statusCode: 500, statusMessage: error.message })
  }

  return { ok: true, checked_at: new Date().toISOString() }
})
