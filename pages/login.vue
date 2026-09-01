<script setup lang="ts">
definePageMeta({ layout: 'auth' })

// Si Supabase termina redirigiendo acá en vez de a /confirm o
// /actualizar-password (pasa cuando el Site URL configurado en el
// dashboard no coincide con el que arma la app), el fragmento de la URL
// igual trae la sesión — no hace falta perderla. Se revisa antes que
// cualquier otra cosa y, si hay algo que procesar, se manda de una a la
// página que sabe qué hacer con eso, preservando el fragmento.
if (import.meta.client && window.location.hash) {
  const hash = new URLSearchParams(window.location.hash.slice(1))
  const haySesionOError = hash.has('access_token') || hash.has('error') || hash.has('error_description')
  if (haySesionOError) {
    const destino = hash.get('type') === 'recovery' ? '/actualizar-password' : '/confirm'
    window.location.replace(destino + window.location.hash)
  }
}

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()

const email = ref('')
const password = ref('')
const cargando = ref(false)
const error = ref<string | null>(null)

const modo = ref<'ingresar' | 'recuperar'>('ingresar')
const recuperando = ref(false)
const recuperarOk = ref(false)
const errorRecuperar = ref<string | null>(null)

watch(
  user,
  (u) => {
    if (u) router.push('/')
  },
  { immediate: true }
)

async function iniciarSesion() {
  cargando.value = true
  error.value = null
  const { error: err } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value,
  })
  if (err) {
    error.value = err.message === 'Invalid login credentials'
      ? 'Correo o contraseña incorrectos'
      : err.message
  }
  cargando.value = false
}

function irARecuperar() {
  errorRecuperar.value = null
  recuperarOk.value = false
  modo.value = 'recuperar'
}

async function enviarRecuperacion() {
  if (!email.value.trim()) {
    errorRecuperar.value = 'Ingresa tu correo electrónico'
    return
  }
  recuperando.value = true
  errorRecuperar.value = null
  const { error: err } = await supabase.auth.resetPasswordForEmail(email.value.trim(), {
    redirectTo: `${window.location.origin}/actualizar-password`,
  })
  recuperando.value = false
  if (err) {
    errorRecuperar.value = err.message
    return
  }
  recuperarOk.value = true
}
</script>

<template>
  <div class="card login-card">
    <h1 class="login-title">Contabilify</h1>

    <template v-if="modo === 'ingresar'">
      <p class="text-muted login-sub">Inicia sesión con tu cuenta para continuar</p>

      <form class="stack" @submit.prevent="iniciarSesion">
        <div class="field">
          <label for="email">Correo electrónico</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="input"
          >
        </div>

        <div class="field">
          <label for="password">Contraseña</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="input"
          >
        </div>

        <p v-if="error" class="alert alert-error">{{ error }}</p>

        <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="cargando">
          {{ cargando ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>

      <div class="login-links">
        <button type="button" class="btn btn-ghost" @click="irARecuperar">¿Olvidaste tu contraseña?</button>
      </div>

      <p class="text-muted login-help">
        ¿No tienes cuenta? Pídele al administrador de la asociación que te invite.
      </p>
    </template>

    <template v-else>
      <p class="text-muted login-sub">Te enviamos un enlace para restablecer tu contraseña</p>

      <form v-if="!recuperarOk" class="stack" @submit.prevent="enviarRecuperacion">
        <div class="field">
          <label for="email-recuperar">Correo electrónico</label>
          <input
            id="email-recuperar"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="input"
          >
        </div>

        <p v-if="errorRecuperar" class="alert alert-error">{{ errorRecuperar }}</p>

        <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="recuperando">
          {{ recuperando ? 'Enviando…' : 'Enviar enlace de recuperación' }}
        </button>
      </form>

      <p v-else class="alert alert-ok">
        Si el correo está registrado, te llegará un enlace para elegir una contraseña nueva.
      </p>

      <div class="login-links">
        <button type="button" class="btn btn-ghost" @click="modo = 'ingresar'">← Volver a iniciar sesión</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.login-card {
  width: 100%;
  max-width: 360px;
}

.login-title {
  text-align: center;
  color: var(--color-primary);
}

.login-sub {
  text-align: center;
  margin-bottom: 1.5rem;
}

.login-links {
  margin-top: 0.85rem;
  text-align: center;
}

.login-help {
  margin-top: 1.25rem;
  font-size: 0.85rem;
  text-align: center;
}
</style>
