<script setup lang="ts">
const props = defineProps<{
  modelValue: string // yyyy-mm-dd
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const texto = ref(props.modelValue)

watch(
  () => props.modelValue,
  (nuevo) => {
    texto.value = nuevo
  }
)

const legible = computed(() => formatoFechaLegible(props.modelValue))

function confirmarTexto() {
  const normalizada = normalizarFecha(texto.value)
  if (normalizada) {
    emit('update:modelValue', normalizada)
    texto.value = normalizada
  } else {
    // texto inválido: volvemos al último valor válido
    texto.value = props.modelValue
  }
}

function paso(delta: number) {
  emit('update:modelValue', sumarDias(props.modelValue, delta))
}

function alPresionarTecla(evento: KeyboardEvent) {
  if (evento.key === 'ArrowUp') {
    evento.preventDefault()
    paso(1)
  } else if (evento.key === 'ArrowDown') {
    evento.preventDefault()
    paso(-1)
  } else if (evento.key === 'Enter') {
    confirmarTexto()
  }
}
</script>

<template>
  <div class="date-stepper">
    <button
      type="button"
      class="btn stepper-btn"
      aria-label="Un día antes"
      @click="paso(-1)"
    >
      &#8595;
    </button>

    <div class="date-input-wrap">
      <input
        v-model="texto"
        type="text"
        inputmode="numeric"
        placeholder="aaaa-mm-dd"
        class="input date-input"
        @blur="confirmarTexto"
        @keydown="alPresionarTecla"
      >
      <span class="date-legible text-muted">{{ legible }}</span>
    </div>

    <button
      type="button"
      class="btn stepper-btn"
      aria-label="Un día después"
      @click="paso(1)"
    >
      &#8593;
    </button>
  </div>
</template>

<style scoped>
.date-stepper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stepper-btn {
  padding: 0.65em 0.9em;
  font-size: 1.1rem;
  line-height: 1;
}

.date-input-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.date-input {
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 1.05rem;
}

.date-legible {
  text-align: center;
  font-size: 0.78rem;
  text-transform: capitalize;
}
</style>
