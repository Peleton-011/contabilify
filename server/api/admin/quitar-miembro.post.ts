import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/database'

// Saca a un usuario de un ledger (borra su fila de ledger_members), no su
// cuenta de Supabase: la misma persona puede pertenecer a otros ledgers, así
// que borrar la cuenta entera rompería su acceso a esos otros.
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) throw createError({ statusCode: 401, statusMessage: 'No autorizado' })

  const body = await readBody<{ userId?: string; ledgerId?: string }>(event)
  const userId = body?.userId
  const ledgerId = body?.ledgerId
  if (!ledgerId) throw createError({ statusCode: 400, statusMessage: 'Falta el ledger' })
  if (!userId) throw createError({ statusCode: 400, statusMessage: 'Falta el id del usuario' })
  if (userId === user.id) {
    throw createError({ statusCode: 400, statusMessage: 'No puedes quitarte a ti mismo del ledger' })
  }

  const supabase = await serverSupabaseClient<Database>(event)
  const { data: miembro, error: errMiembro } = await supabase
    .from('ledger_members')
    .select('role')
    .eq('ledger_id', ledgerId)
    .eq('user_id', user.id)
    .single()

  if (errMiembro || miembro?.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Solo un administrador puede quitar usuarios' })
  }

  const admin = serverSupabaseServiceRole<Database>(event)
  const { error } = await admin
    .from('ledger_members')
    .delete()
    .eq('ledger_id', ledgerId)
    .eq('user_id', userId)
  if (error) throw createError({ statusCode: 400, statusMessage: error.message })

  return { ok: true }
})
