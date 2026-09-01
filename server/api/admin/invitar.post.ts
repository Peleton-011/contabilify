import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/database'

// Invita a un usuario nuevo por correo electrónico. Solo un admin puede
// llamar a este endpoint: la invitación en sí requiere la service role key
// (Admin API de Supabase), así que la verificación de permisos se hace aquí,
// en el servidor, antes de usarla.
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'No autorizado' })
  }

  const supabase = await serverSupabaseClient<Database>(event)
  const { data: perfil, error: errPerfil } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (errPerfil || perfil?.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Solo un administrador puede invitar usuarios' })
  }

  const body = await readBody<{ email?: string }>(event)
  const email = body?.email?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa un correo electrónico válido' })
  }

  const redirectTo = `${obtenerSiteUrl(event)}/confirm`

  const admin = serverSupabaseServiceRole<Database>(event)
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }

  // Se devuelve para poder verificar en /usuarios que el enlace apunta a
  // donde corresponde, sin tener que ir a buscar los logs de Vercel.
  return { ok: true, userId: data.user?.id ?? null, redirectTo }
})
