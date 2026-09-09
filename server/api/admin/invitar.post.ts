import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/database'

// Agrega a un usuario a un ledger por correo electrónico. Si el correo ya
// tiene una cuenta en Contabilify (de otro ledger), solo se le suma la
// membresía; si es la primera vez, se lo invita por correo (Admin API,
// requiere la service role key) y se crea la membresía apenas exista el
// usuario. Solo un admin del ledger puede llamar a este endpoint.
export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'No autorizado' })
  }

  const body = await readBody<{ email?: string; ledgerId?: string }>(event)
  const email = body?.email?.trim().toLowerCase()
  const ledgerId = body?.ledgerId
  if (!ledgerId) {
    throw createError({ statusCode: 400, statusMessage: 'Falta el ledger' })
  }
  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Ingresa un correo electrónico válido' })
  }

  const supabase = await serverSupabaseClient<Database>(event)
  const { data: miembro, error: errMiembro } = await supabase
    .from('ledger_members')
    .select('role')
    .eq('ledger_id', ledgerId)
    .eq('user_id', user.id)
    .single()

  if (errMiembro || miembro?.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Solo un administrador puede invitar usuarios' })
  }

  // A partir de acá se usa la service role: hay que poder buscar el perfil
  // por correo aunque todavía no comparta ningún ledger con quien invita
  // (el RLS de profiles no lo dejaría ver ese perfil).
  const admin = serverSupabaseServiceRole<Database>(event)

  const { data: existente } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()

  let userId: string
  let redirectTo: string | null = null

  if (existente) {
    userId = existente.id
  } else {
    redirectTo = `${obtenerSiteUrl(event)}/confirm`
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
    if (error) throw createError({ statusCode: 400, statusMessage: error.message })
    if (!data.user) {
      throw createError({ statusCode: 500, statusMessage: 'No se pudo crear el usuario invitado' })
    }
    userId = data.user.id
  }

  const { error: errMiembroNuevo } = await admin
    .from('ledger_members')
    .upsert(
      { ledger_id: ledgerId, user_id: userId, role: 'member' },
      { onConflict: 'ledger_id,user_id', ignoreDuplicates: true }
    )
  if (errMiembroNuevo) {
    throw createError({ statusCode: 400, statusMessage: errMiembroNuevo.message })
  }

  // Se devuelve para poder verificar en /usuarios que el enlace apunta a
  // donde corresponde, sin tener que ir a buscar los logs de Vercel.
  return { ok: true, userId, redirectTo }
})
