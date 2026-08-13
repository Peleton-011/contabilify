import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/database'

// Elimina un usuario (auth.users + su fila en profiles, por el on delete
// cascade de la migración inicial). Requiere la service role key, así que
// la verificación de permisos se hace acá, en el servidor.
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
    throw createError({ statusCode: 403, statusMessage: 'Solo un administrador puede eliminar usuarios' })
  }

  const body = await readBody<{ id?: string }>(event)
  const id = body?.id
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el id del usuario' })
  }

  if (id === user.id) {
    throw createError({ statusCode: 400, statusMessage: 'No puedes eliminar tu propia cuenta' })
  }

  const admin = serverSupabaseServiceRole<Database>(event)
  const { error } = await admin.auth.admin.deleteUser(id)

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }

  return { ok: true }
})
