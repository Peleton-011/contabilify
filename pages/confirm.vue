<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const router = useRouter()
const { actualizarNombre } = useProfile()

type Estado = 'verificando' | 'formulario' | 'error'

const estado = ref<Estado>('verificando')
const mensajeError = ref<string | null>(null)
const emailUsuario = ref('')

const nombre = ref('')
const password = ref('')
const confirmacion = ref('')
const guardando = ref(false)
const errorGuardar = ref<string | null>(null)

// El enlace de invitación (el de Supabase por defecto, sin plantilla
// personalizada) redirige acá con la sesión en el fragmento de la URL
// (#access_token=...&refresh_token=...&type=invite), no como ?code=. El
// cliente de Supabase de este proyecto (@supabase/ssr) fuerza flowType
// "pkce" y esa configuración hace que el auto-detectado de sesión en la URL
// RECHACE ese formato en vez de procesarlo (piensa que es un enlace de un
// flujo distinto al que espera) — por eso el enlace de invitación llevaba a
// /login sin sesión. Acá lo leemos nosotros mismos y armamos la sesión con
// `setSession`, que no depende del flowType configurado.
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

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  // Ya no hace falta el fragmento en la URL (ni conviene dejarlo, son
  // credenciales de sesión).
  window.history.replaceState(null, '', window.location.pathname)

  if (error || !data.user) {
    estado.value = 'error'
    mensajeError.value = error?.message ?? 'No pudimos confirmar el enlace.'
    return
  }

  emailUsuario.value = data.user.email ?? ''
  estado.value = 'formulario'
})

async function guardar() {
  errorGuardar.value = null

  if (!nombre.value.trim()) {
    errorGuardar.value = 'Ingresa tu nombre'
    return
  }
  if (password.value.length < 8) {
    errorGuardar.value = 'La contraseña debe tener al menos 8 caracteres'
    return
  }
  if (password.value !== confirmacion.value) {
    errorGuardar.value = 'Las contraseñas no coinciden'
    return
  }

  guardando.value = true
  try {
    await actualizarNombre(nombre.value)
    const { error } = await supabase.auth.updateUser({ password: password.value })
    if (error) throw error
    router.push('/')
  } catch (err) {
    errorGuardar.value = err instanceof Error ? err.message : 'No se pudo crear la cuenta'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="card confirm-card">
    <template v-if="estado === 'verificando'">
      <p>Confirmando tu invitación…</p>
    </template>

    <template v-else-if="estado === 'error'">
      <p class="alert alert-error">{{ mensajeError }}</p>
      <p class="text-muted ayuda">
        Pídele a un administrador que te envíe una invitación nueva, o si ya tienes cuenta,
        inicia sesión con tu contraseña.
      </p>
      <NuxtLink to="/login" class="btn btn-primary btn-block">Ir a iniciar sesión</NuxtLink>
    </template>

    <template v-else>
      <h1 class="titulo">Crea tu cuenta</h1>
      <p class="text-muted subtitulo">Elige tu nombre y una contraseña para terminar de crear tu cuenta.</p>

      <form class="stack" @submit.prevent="guardar">
        <div class="field">
          <label for="email">Correo electrónico</label>
          <input id="email" :value="emailUsuario" type="email" class="input" disabled>
        </div>

        <div class="field">
          <label for="nombre">Nombre completo</label>
          <input id="nombre" v-model="nombre" type="text" autocomplete="name" required class="input">
        </div>

        <div class="field">
          <label for="password">Elige una contraseña</label>
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

        <p v-if="errorGuardar" class="alert alert-error">{{ errorGuardar }}</p>

        <button type="submit" class="btn btn-primary btn-block btn-lg" :disabled="guardando">
          {{ guardando ? 'Creando cuenta…' : 'Crear cuenta' }}
        </button>
      </form>
    </template>
  </div>
</template>

<style scoped>
.confirm-card {
  width: 100%;
  max-width: 360px;
}

.titulo {
  text-align: center;
  color: var(--color-primary);
}

.subtitulo {
  text-align: center;
  margin-bottom: 1.5rem;
}

.ayuda {
  font-size: 0.85rem;
  text-align: center;
}
</style>
