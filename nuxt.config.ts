export default defineNuxtConfig({
  compatibilityDate: '2025-07-31',
  devtools: { enabled: true },

  modules: ['@nuxtjs/supabase'],

  supabase: {
    // El módulo protege todas las rutas por defecto y redirige a /login
    // si no hay sesión. Las páginas públicas se listan en `exclude`.
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/login'],
    },
  },

  runtimeConfig: {
    // Secreto para autenticar al cron de keepalive (server/api/keepalive.get.ts).
    // Se define en Vercel como variable de entorno CRON_SECRET.
    cronSecret: process.env.CRON_SECRET,
  },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'Contabilify',
      htmlAttrs: { lang: 'es' },
      meta: [
        { name: 'description', content: 'Control de ingresos, egresos y saldos de caja y banco.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1' },
      ],
    },
  },

  typescript: {
    strict: true,
  },
})
