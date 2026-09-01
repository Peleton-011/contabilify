import type { H3Event } from 'h3'

/**
 * Fuerza https salvo en localhost. Detrás de un proxy (Vercel incluido) la
 * cabecera Origin a veces llega en http aunque el usuario esté en https —
 * y Supabase rechaza el `redirectTo` si no coincide *exactamente* (esquema
 * incluido) con lo que está en "Redirect URLs", así que un http de más acá
 * hace que la invitación caiga de vuelta al Site URL por defecto y nunca
 * llegue a /confirm.
 */
function forzarHttps(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
      parsed.protocol = 'https:'
    }
    return parsed.origin
  } catch {
    return url
  }
}

/**
 * URL base de la app para construir enlaces (ej. `redirectTo` de invitaciones).
 * Usa la cabecera Origin de la petición (refleja el dominio real desde el que
 * el admin está usando la app, sea producción, un preview o localhost) y cae
 * en `NUXT_PUBLIC_SITE_URL` solo si no está presente.
 */
export function obtenerSiteUrl(event: H3Event): string {
  const origin = getRequestHeader(event, 'origin')
  if (origin) return forzarHttps(origin)
  return forzarHttps(useRuntimeConfig(event).public.siteUrl)
}
