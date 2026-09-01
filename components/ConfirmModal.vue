<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    abierto: boolean
    titulo: string
    mensaje: string
    textoConfirmar?: string
    textoCancelar?: string
    peligroso?: boolean
    procesando?: boolean
  }>(),
  {
    textoConfirmar: 'Confirmar',
    textoCancelar: 'Cancelar',
    peligroso: false,
    procesando: false,
  }
)

const emit = defineEmits<{
  confirmar: []
  cancelar: []
}>()

function alPresionarEscape(evento: KeyboardEvent) {
  if (evento.key === 'Escape' && props.abierto) emit('cancelar')
}

onMounted(() => window.addEventListener('keydown', alPresionarEscape))
onUnmounted(() => window.removeEventListener('keydown', alPresionarEscape))
</script>

<template>
  <Teleport to="body">
    <div v-if="abierto" class="modal-backdrop" @click.self="emit('cancelar')">
      <div class="card modal-card" role="alertdialog" aria-modal="true">
        <h2 class="modal-titulo">{{ titulo }}</h2>
        <p class="text-muted modal-mensaje">{{ mensaje }}</p>

        <div class="row modal-acciones">
          <span class="spacer" />
          <button type="button" class="btn btn-ghost" :disabled="procesando" @click="emit('cancelar')">
            {{ textoCancelar }}
          </button>
          <button
            type="button"
            class="btn"
            :class="peligroso ? 'btn-danger' : 'btn-primary'"
            :disabled="procesando"
            @click="emit('confirmar')"
          >
            {{ procesando ? 'Procesando…' : textoConfirmar }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: color-mix(in oklch, var(--color-text) 45%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  z-index: 100;
}

.modal-card {
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-md);
}

.modal-titulo {
  margin: 0 0 0.5em;
  font-size: 1.2rem;
}

.modal-mensaje {
  margin: 0 0 1.25rem;
}

.modal-acciones {
  gap: 0.6rem;
}
</style>
