import { serverSupabaseClient, serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'
import type { Database } from '~/types/database'

// Invita a un usuario nuevo por correo electrónico. Solo un admin puede
// llamar a este endpoint: la invitación en sí requiere la service role key
// (Admin API de Supabase), así que la verificación de permisos se hace aquí,
// en el servidor, antes de usarla.
//
// No usa `inviteUserByEmail` (que manda el correo con la plantilla y el
// enlace de Supabase): ese enlace pasa por el `/auth/v1/verify` de Supabase,
// que solo redirige de vuelta con la sesión armada si la URL de la app está
// en la lista de "Redirect URLs" del dashboard — si no coincide, redirige
// igual pero sin sesión, y la persona invitada queda varada en /login sin
// poder entrar. `generateLink` crea el usuario igual, pero nos devuelve el
// `hashed_token` directamente: armamos nuestro propio enlace a /confirm (que
// lo verifica con `verifyOtp`, ver pages/confirm.vue) y lo mandamos por
// nuestro propio SMTP, sin depender en nada de Supabase para el correo.
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

  const admin = serverSupabaseServiceRole<Database>(event)
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { redirectTo: `${obtenerSiteUrl(event)}/confirm` },
  })

  if (error) {
    throw createError({ statusCode: 400, statusMessage: error.message })
  }

  const enlace = `${data.properties.redirect_to}?token_hash=${data.properties.hashed_token}&type=invite`
  const { enviado, error: errorCorreo } = await enviarCorreoInvitacion(email, enlace)

  return {
    ok: true,
    userId: data.user?.id ?? null,
    correoEnviado: enviado,
    // Si no se pudo mandar el correo (SMTP sin configurar o con error), el
    // admin recibe el enlace para copiarlo y mandarlo a mano en vez de
    // quedarse sin ninguna forma de invitar.
    enlace: enviado ? null : enlace,
    errorCorreo: enviado ? null : errorCorreo,
  }
})
