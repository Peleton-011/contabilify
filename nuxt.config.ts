export default defineNuxtConfig({
  compatibilityDate: '2025-07-31',
  devtools: { enabled: true },

  modules: ['@nuxtjs/supabase'],

  supabase: {
    // El módulo protege todas las rutas por defecto y redirige a /login
    // si no hay sesión. Las páginas públicas se listan en `exclude`.
    // `/confirm` ya queda afuera por ser `callback`, pero se agrega también
    // acá de forma explícita para que quede claro y no dependa solo de eso.
    // `/actualizar-password` tiene que estar en la lista: llega sin sesión
    // (la arma ella misma a partir del fragmento de la URL, ver el
    // comentario en esa página) y sin este exclude el middleware la manda a
    // /login antes de que el componente llegue a montarse.
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/login', '/confirm', '/actualizar-password'],
    },
  },

  runtimeConfig: {
    // Secreto para autenticar al cron de keepalive (server/api/keepalive.get.ts).
    // Se define en Vercel como variable de entorno CRON_SECRET.
    cronSecret: process.env.CRON_SECRET,

    public: {
      // Usada como último recurso por el servidor (ej. el link de las
      // invitaciones) cuando la petición no trae cabecera Origin. En el
      // cliente no hace falta: se usa window.location.origin directamente.
      // IMPORTANTE: esto no reemplaza configurar "Site URL" y "Redirect URLs"
      // en Supabase (Authentication > URL Configuration) — ver README.
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    },
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
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;800;900&family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&display=swap',
        },
      ],
    },
  },

  typescript: {
    strict: true,
  },
})
