<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()

const password = ref('')
const confirmacion = ref('')
const guardando = ref(false)
const error = ref<string | null>(null)
const ok = ref(false)

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

    <p v-if="!user" class="text-muted centrado">
      Verificando el enlace de recuperación…
    </p>

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
</style>
