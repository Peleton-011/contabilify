<script setup lang="ts">
defineProps<{
  nombre: string
  saldo: number
  destacado?: boolean
}>()
</script>

<template>
  <div class="card balance-card" :class="{ destacado }">
    <span class="balance-nombre text-muted">{{ nombre }}</span>
    <span class="balance-monto">{{ formatoMonto(saldo) }}</span>
  </div>
</template>

<style scoped>
.balance-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.balance-card.destacado {
  border-color: var(--color-primary);
}

.balance-nombre {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 700;
}

.balance-monto {
  font-size: 1.5rem;
  font-weight: 800;
}
</style>
