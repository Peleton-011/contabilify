<script setup lang="ts">
import type { EmailOtpType } from '@supabase/supabase-js'

definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const route = useRoute()
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

// El enlace de invitación apunta acá con ?token_hash=...&type=invite (ver
// supabase/email-templates/invite-user.html). Verificamos el token nosotros
// mismos con `verifyOtp` en vez de depender de que el cliente detecte
// automáticamente un hash/código en la URL: eso dependía de la configuración
// de "Redirect URLs" del dashboard de Supabase y fallaba en silencio cuando
// no coincidía exactamente, dejando al usuario varado en /login sin poder
// entrar (sin contraseña) ni recuperarla (necesita sesión para eso).
onMounted(async () => {
  const tokenHash = route.query.token_hash
  const type = route.query.type

  if (typeof tokenHash !== 'string' || typeof type !== 'string') {
    estado.value = 'error'
    mensajeError.value = 'Este enlace no es válido.'
    return
  }

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  })

  if (error || !data.user) {
    estado.value = 'error'
    mensajeError.value =
      error?.message === 'Token has expired or is invalid'
        ? 'Este enlace ya no es válido o expiró.'
        : (error?.message ?? 'No pudimos confirmar el enlace.')
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
