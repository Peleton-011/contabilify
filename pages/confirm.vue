<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const user = useSupabaseUser()
const router = useRouter()
const route = useRoute()

// Supabase agrega el error como parámetro de query (?error=...) o, en los
// enlaces con tokens implícitos, como fragmento (#error=...). Cubrimos los
// dos casos para no dejar al usuario mirando "Confirmando…" para siempre
// cuando el enlace ya expiró o se usó antes.
const errorDescripcion = ref<string | null>(null)

function leerErrorDeUrl(): string | null {
  const deQuery = route.query.error_description || route.query.error
  if (typeof deQuery === 'string') return deQuery

  if (import.meta.client && window.location.hash) {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const desc = params.get('error_description') || params.get('error')
    if (desc) return desc
  }
  return null
}

// Si a los 8 segundos no llegó la sesión ni tampoco un error explícito,
// asumimos que algo salió mal (enlace ya usado, dominio no permitido en
// Supabase, etc.) en vez de dejar la pantalla de carga colgada para siempre.
let timeoutId: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  errorDescripcion.value = leerErrorDeUrl()
  if (!errorDescripcion.value) {
    timeoutId = setTimeout(() => {
      if (!user.value) {
        errorDescripcion.value = 'timeout'
      }
    }, 8000)
  }
})

onUnmounted(() => {
  if (timeoutId) clearTimeout(timeoutId)
})

watch(
  user,
  (u) => {
    if (u) {
      if (timeoutId) clearTimeout(timeoutId)
      router.push('/')
    }
  },
  { immediate: true }
)

const mensajeError = computed(() => {
  if (errorDescripcion.value === 'timeout') {
    return 'No pudimos confirmar el enlace. Puede que ya haya sido usado o que haya expirado.'
  }
  if (errorDescripcion.value) {
    return decodeURIComponent(errorDescripcion.value.replace(/\+/g, ' '))
  }
  return null
})
</script>

<template>
  <div class="card confirm-card">
    <template v-if="!mensajeError">
      <p>Confirmando tu cuenta…</p>
    </template>
    <template v-else>
      <p class="alert alert-error">{{ mensajeError }}</p>
      <p class="text-muted ayuda">
        Pídele a un administrador que te envíe una invitación nueva, o si ya tienes cuenta,
        inicia sesión con tu contraseña.
      </p>
      <NuxtLink to="/login" class="btn btn-primary btn-block">Ir a iniciar sesión</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.confirm-card {
  max-width: 360px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ayuda {
  font-size: 0.85rem;
}
</style>
