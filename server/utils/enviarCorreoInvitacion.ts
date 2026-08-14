import nodemailer from 'nodemailer'

/**
 * Envía el correo de invitación por SMTP propio. No depende en nada del
 * sistema de correo ni de las plantillas de Supabase: el enlace y el texto
 * los armamos y mandamos nosotros. Si falta configurar el SMTP (o falla el
 * envío), devuelve `enviado: false` en vez de lanzar, para que quien invita
 * pueda igual copiar el enlace a mano en vez de quedar sin ninguna salida.
 */
export async function enviarCorreoInvitacion(destinatario: string, enlace: string): Promise<{ enviado: boolean; error?: string }> {
  const config = useRuntimeConfig()
  const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = config

  if (!smtpHost || !smtpUser || !smtpPass) {
    return { enviado: false, error: 'SMTP no está configurado' }
  }

  const puerto = Number(smtpPort) || 587
  const transporte = nodemailer.createTransport({
    host: smtpHost,
    port: puerto,
    secure: puerto === 465,
    auth: { user: smtpUser, pass: smtpPass },
  })

  try {
    await transporte.sendMail({
      from: smtpFrom || smtpUser,
      to: destinatario,
      subject: 'Te invitaron a Contabilify',
      html: cuerpoCorreo(enlace),
    })
    return { enviado: true }
  } catch (err) {
    return { enviado: false, error: err instanceof Error ? err.message : 'No se pudo enviar el correo' }
  }
}

function cuerpoCorreo(enlace: string): string {
  return `
<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #2b2016;">
  <h1 style="font-family: Arial, Helvetica, sans-serif; font-weight: 800; font-size: 22px; letter-spacing: 0.3px; margin: 0 0 4px;">
    Contabilify
  </h1>
  <p style="font-size: 12px; letter-spacing: 2px; text-transform: uppercase; opacity: 0.6; margin: 0 0 28px;">
    Tesorería de la asociación
  </p>

  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
    Te invitaron a usar <strong>Contabilify</strong>, la app donde llevamos el control de
    ingresos y egresos de la asociación.
  </p>
  <p style="font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
    Para crear tu cuenta y elegir tu contraseña, entrá al siguiente enlace:
  </p>

  <p style="text-align: center; margin: 0 0 28px;">
    <a href="${enlace}"
       style="display: inline-block; background: #7a3418; color: #fdf8f0; text-decoration: none; font-family: Arial, Helvetica, sans-serif; font-weight: 700; font-size: 14px; letter-spacing: 0.5px; padding: 14px 28px; border-radius: 4px;">
      Crear mi cuenta
    </a>
  </p>

  <p style="font-size: 13px; line-height: 1.5; opacity: 0.65; margin: 0 0 4px;">
    Si el botón no funciona, copiá y pegá este enlace en tu navegador:
  </p>
  <p style="font-size: 12px; word-break: break-all; opacity: 0.65; margin: 0 0 28px;">
    ${enlace}
  </p>

  <p style="font-size: 12px; opacity: 0.5; margin: 0;">
    Si no esperabas esta invitación, podés ignorar este correo.
  </p>
</div>
`.trim()
}
