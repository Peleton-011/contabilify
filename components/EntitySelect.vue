<script setup lang="ts">
import type { Entidad } from '~/types/schema'

const props = defineProps<{
  modelValue: string | null
  entidades: Entidad[] // ya deberían venir ordenadas (ej. por frecuencia de uso)
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  seleccionada: [entidad: Entidad | null]
}>()

const { crearEntidad } = useEntidades()

const busqueda = ref('')
const abierto = ref(false)
const creando = ref(false)
const errorCreacion = ref<string | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const seleccionActual = computed(
  () => props.entidades.find((e) => e.id === props.modelValue) ?? null
)

const coincidencias = computed(() => {
  const texto = busqueda.value.trim().toLowerCase()
  if (!texto) return props.entidades.slice(0, 8)
  return props.entidades
    .filter((e) => e.nombre.toLowerCase().includes(texto))
    .slice(0, 8)
})

const existeCoincidenciaExacta = computed(() =>
  props.entidades.some((e) => e.nombre.toLowerCase() === busqueda.value.trim().toLowerCase())
)

const mostrarOpcionCrear = computed(
  () => busqueda.value.trim().length > 0 && !existeCoincidenciaExacta.value
)

function abrir() {
  abierto.value = true
}

function cerrarConRetraso() {
  // retraso para permitir que el click en una opción se registre antes de cerrar
  setTimeout(() => {
    abierto.value = false
  }, 150)
}

function elegir(entidad: Entidad) {
  emit('update:modelValue', entidad.id)
  emit('seleccionada', entidad)
  busqueda.value = ''
  abierto.value = false
}

function quitarSeleccion() {
  emit('update:modelValue', null)
  emit('seleccionada', null)
  busqueda.value = ''
  inputRef.value?.focus()
}

async function crearNueva() {
  const nombre = busqueda.value.trim()
  if (!nombre) return
  creando.value = true
  errorCreacion.value = null
  try {
    const nueva = await crearEntidad(nombre)
    elegir(nueva)
  } catch (err) {
    errorCreacion.value = err instanceof Error ? err.message : 'No se pudo crear la entidad'
  } finally {
    creando.value = false
  }
}

defineExpose({ focus: () => inputRef.value?.focus() })
</script>

<template>
  <div class="entity-select">
    <div v-if="seleccionActual" class="row selected-pill">
      <span class="pill">{{ seleccionActual.nombre }}</span>
      <button type="button" class="btn btn-ghost" @click="quitarSeleccion">Cambiar</button>
    </div>

    <div v-else class="combo">
      <input
        ref="inputRef"
        v-model="busqueda"
        type="text"
        class="input"
        placeholder="Buscar o escribir entidad nueva…"
        @focus="abrir"
        @blur="cerrarConRetraso"
      >

      <ul v-if="abierto && (coincidencias.length || mostrarOpcionCrear)" class="dropdown">
        <li
          v-for="entidad in coincidencias"
          :key="entidad.id"
          class="dropdown-item"
          @mousedown.prevent="elegir(entidad)"
        >
          {{ entidad.nombre }}
        </li>

        <li
          v-if="mostrarOpcionCrear"
          class="dropdown-item dropdown-item-new"
          @mousedown.prevent="crearNueva"
        >
          {{ creando ? 'Agregando…' : `+ Agregar “${busqueda.trim()}” como nueva entidad` }}
        </li>
      </ul>

      <button
        v-if="!busqueda"
        type="button"
        class="btn btn-ghost btn-skip"
        @mousedown.prevent="quitarSeleccion"
      >
        Sin entidad / continuar sin elegir
      </button>
    </div>

    <p v-if="errorCreacion" class="alert alert-error">{{ errorCreacion }}</p>
  </div>
</template>

<style scoped>
.entity-select {
  position: relative;
}

.selected-pill {
  align-items: center;
}

.pill {
  background: var(--color-primary);
  color: var(--color-primary-contrast);
  border-radius: 999px;
  padding: 0.5em 1em;
  font-weight: 600;
}

.combo {
  position: relative;
}

.dropdown {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  list-style: none;
  margin: 0;
  padding: 0.3rem;
  max-height: 240px;
  overflow-y: auto;
}

.dropdown-item {
  padding: 0.6em 0.7em;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.dropdown-item:hover {
  background: var(--color-bg);
}

.dropdown-item-new {
  color: var(--color-primary);
  font-weight: 600;
}

.btn-skip {
  margin-top: 0.4rem;
  font-size: 0.82rem;
  font-weight: 500;
  padding: 0.3em 0;
  color: var(--color-text-muted);
}
</style>
