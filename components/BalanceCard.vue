<script setup lang="ts">
defineProps<{
  nombre: string
  saldo: number
  destacado?: boolean
  seleccionable?: boolean
  seleccionada?: boolean
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <component
    :is="seleccionable ? 'button' : 'div'"
    :type="seleccionable ? 'button' : undefined"
    class="card balance-card"
    :class="{ destacado, seleccionable, seleccionada }"
    @click="seleccionable && $emit('click')"
  >
    <span class="balance-nombre text-muted">{{ nombre }}</span>
    <span class="balance-monto">{{ formatoMonto(saldo) }}</span>
    <span v-if="seleccionable" class="balance-estado" :class="{ activa: seleccionada }">
      {{ seleccionada ? '✓ Cuenta activa' : 'Elegir como cuenta activa' }}
    </span>
  </component>
</template>

<style scoped>
.balance-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.balance-card.destacado {
  border-width: 2px;
  border-color: var(--color-text);
}

.balance-card.seleccionable {
  width: 100%;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.balance-card.seleccionable:hover {
  border-color: var(--color-primary);
}

.balance-card.seleccionada {
  border-color: var(--color-primary);
  border-width: 2px;
  background: color-mix(in oklch, var(--color-primary) 8%, var(--color-surface));
}

.balance-nombre {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 700;
}

.balance-monto {
  font-family: var(--font-body);
  font-size: 1.5rem;
  font-weight: 800;
}

.balance-estado {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.balance-estado.activa {
  color: var(--color-primary);
}
</style>
