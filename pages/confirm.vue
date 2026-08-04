<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const user = useSupabaseUser()
const router = useRouter()

watch(
  user,
  (u) => {
    if (u) router.push('/')
  },
  { immediate: true }
)
</script>

<template>
  <div class="card confirm-card">
    <p>Confirmando tu cuenta…</p>
  </div>
</template>

<style scoped>
.confirm-card {
  max-width: 320px;
  text-align: center;
}
</style>
