<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()

const email = ref('')
const password = ref('')
const cargando = ref(false)
const error = ref<string | null>(null)

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
</script>

<template>
  <div class="card login-card">
    <h1 class="login-title">Contabilify</h1>
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

    <p class="text-muted login-help">
      ¿No tienes cuenta? Pídele al administrador de la asociación que te invite.
    </p>
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

.login-help {
  margin-top: 1.25rem;
  font-size: 0.85rem;
  text-align: center;
}
</style>
