import type { H3Event } from 'h3'

/**
 * URL base de la app para construir enlaces (ej. `redirectTo` de invitaciones).
 * Usa la cabecera Origin de la petición (refleja el dominio real desde el que
 * el admin está usando la app, sea producción, un preview o localhost) y cae
 * en `NUXT_PUBLIC_SITE_URL` solo si no está presente.
 */
export function obtenerSiteUrl(event: H3Event): string {
  const origin = getRequestHeader(event, 'origin')
  if (origin) return origin
  return useRuntimeConfig(event).public.siteUrl
}
