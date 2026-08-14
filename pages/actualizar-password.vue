<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const router = useRouter()

type Estado = 'verificando' | 'formulario' | 'error'

const estado = ref<Estado>('verificando')
const mensajeError = ref<string | null>(null)

const password = ref('')
const confirmacion = ref('')
const guardando = ref(false)
const error = ref<string | null>(null)
const ok = ref(false)

// Mismo problema y misma solución que /confirm: el enlace de recuperación
// de Supabase redirige con la sesión en el fragmento de la URL, y el
// cliente (forzado a flowType "pkce") lo rechaza en vez de detectarlo solo.
// Lo leemos nosotros mismos y armamos la sesión a mano.
onMounted(async () => {
  const hash = new URLSearchParams(window.location.hash.slice(1))

  const errorDescripcion = hash.get('error_description') || hash.get('error')
  if (errorDescripcion) {
    estado.value = 'error'
    mensajeError.value = decodeURIComponent(errorDescripcion.replace(/\+/g, ' '))
    return
  }

  const accessToken = hash.get('access_token')
  const refreshToken = hash.get('refresh_token')

  if (!accessToken || !refreshToken) {
    estado.value = 'error'
    mensajeError.value = 'Este enlace no es válido.'
    return
  }

  const { error: errSesion } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  window.history.replaceState(null, '', window.location.pathname)

  if (errSesion) {
    estado.value = 'error'
    mensajeError.value = errSesion.message
    return
  }

  estado.value = 'formulario'
})

async function guardar() {
  error.value = null
  if (password.value.length < 8) {
    error.value = 'La contraseña debe tener al menos 8 caracteres'
    return
  }
  if (password.value !== confirmacion.value) {
    error.value = 'Las contraseñas no coinciden'
    return
  }

  guardando.value = true
  const { error: err } = await supabase.auth.updateUser({ password: password.value })
  guardando.value = false

  if (err) {
    error.value = err.message
    return
  }
  ok.value = true
  setTimeout(() => router.push('/'), 1200)
}
</script>

<template>
  <div class="card actualizar-card">
    <h1 class="titulo">Nueva contraseña</h1>

    <p v-if="estado === 'verificando'" class="text-muted centrado">
      Verificando el enlace de recuperación…
    </p>

    <template v-else-if="estado === 'error'">
      <p class="alert alert-error">{{ mensajeError }}</p>
      <p class="text-muted ayuda">
        Pídele a un administrador que te envíe una invitación nueva, o volvé a pedir el enlace
        de recuperación desde el login.
      </p>
      <NuxtLink to="/login" class="btn btn-primary btn-block">Ir a iniciar sesión</NuxtLink>
    </template>

    <template v-else-if="!ok">
      <p class="text-muted centrado">Elige una contraseña nueva para tu cuenta.</p>

      <form class="stack" @submit.prevent="guardar">
        <div class="field">
          <label for="password">Contraseña nueva</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            required
            class="input"
          >
        </div>

        <div class="field">
          <label for="confirmacion">Confirmar contraseña</label>
          <input
            id="confirmacion"
            v-model="confirmacion"
            type="password"
            autocomplete="new-password"
            required
            class="input"
          >
        </div>

        <p v-if="error" class="alert alert-error">{{ error }}</p>

        <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="guardando">
          {{ guardando ? 'Guardando…' : 'Guardar contraseña' }}
        </button>
      </form>
    </template>

    <p v-else class="alert alert-ok">Contraseña actualizada. Redirigiendo…</p>
  </div>
</template>

<style scoped>
.actualizar-card {
  width: 100%;
  max-width: 360px;
}

.titulo {
  text-align: center;
  color: var(--color-primary);
}

.centrado {
  text-align: center;
  margin-bottom: 1.5rem;
}

.ayuda {
  font-size: 0.85rem;
  text-align: center;
}
</style>
