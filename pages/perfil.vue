<script setup lang="ts">
const { profile, perfilCompleto, actualizarNombre } = useProfile()
const supabase = useSupabaseClient()
const router = useRouter()

const esPrimeraVez = computed(() => !perfilCompleto.value)

const nombre = ref(profile.value?.full_name ?? '')
const password = ref('')
const confirmacion = ref('')
const guardando = ref(false)
const error = ref<string | null>(null)
const ok = ref(false)

watch(profile, (p) => {
  if (p?.full_name && !nombre.value) nombre.value = p.full_name
})

async function guardar() {
  error.value = null
  ok.value = false

  if (!nombre.value.trim()) {
    error.value = 'Ingresa tu nombre'
    return
  }

  const quiereCambiarPassword = password.value.length > 0 || confirmacion.value.length > 0
  if (esPrimeraVez.value && !quiereCambiarPassword) {
    error.value = 'Elige una contraseña para tu cuenta'
    return
  }
  if (quiereCambiarPassword) {
    if (password.value.length < 8) {
      error.value = 'La contraseña debe tener al menos 8 caracteres'
      return
    }
    if (password.value !== confirmacion.value) {
      error.value = 'Las contraseñas no coinciden'
      return
    }
  }

  const eraPrimeraVez = esPrimeraVez.value
  guardando.value = true
  try {
    await actualizarNombre(nombre.value)
    if (quiereCambiarPassword) {
      const { error: errPass } = await supabase.auth.updateUser({ password: password.value })
      if (errPass) throw errPass
    }
    password.value = ''
    confirmacion.value = ''
    ok.value = true
    if (eraPrimeraVez) {
      setTimeout(() => router.push('/'), 900)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo guardar el perfil'
  } finally {
    guardando.value = false
  }
}
</script>

<template>
  <div class="stack perfil-stack">
    <h1>{{ esPrimeraVez ? 'Crea tu cuenta' : 'Mi perfil' }}</h1>
    <p v-if="esPrimeraVez" class="text-muted">
      Ya confirmaste tu correo. Elige tu nombre y una contraseña para terminar de crear tu
      cuenta y empezar a usar Contabilify.
    </p>

    <form class="card stack" @submit.prevent="guardar">
      <div class="field">
        <label for="nombre">Nombre completo</label>
        <input id="nombre" v-model="nombre" type="text" class="input" required>
      </div>

      <div class="field">
        <label for="email">Correo electrónico</label>
        <input id="email" :value="profile?.email ?? ''" type="email" class="input" disabled>
      </div>

      <div class="field">
        <label for="password">{{ esPrimeraVez ? 'Elige una contraseña' : 'Contraseña nueva (opcional)' }}</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="new-password"
          class="input"
        >
      </div>

      <div v-if="password" class="field">
        <label for="confirmacion">Confirmar contraseña</label>
        <input
          id="confirmacion"
          v-model="confirmacion"
          type="password"
          autocomplete="new-password"
          class="input"
        >
      </div>

      <p v-if="error" class="alert alert-error">{{ error }}</p>
      <p v-if="ok" class="alert alert-ok">Perfil actualizado.</p>

      <button type="submit" class="btn btn-primary" :disabled="guardando">
        {{ guardando ? 'Guardando…' : 'Guardar' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.perfil-stack {
  max-width: 420px;
}
</style>
