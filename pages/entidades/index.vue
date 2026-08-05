<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const {
  entidadesTodasPorFrecuencia,
  usoPorEntidad,
  fetchEntidades,
  crearEntidad,
  actualizarEntidad,
  eliminarEntidad,
} = useEntidades()

await fetchEntidades()

const nombreNuevo = ref('')
const creando = ref(false)
const error = ref<string | null>(null)

async function agregar() {
  if (!nombreNuevo.value.trim()) return
  creando.value = true
  error.value = null
  try {
    await crearEntidad(nombreNuevo.value)
    nombreNuevo.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo crear la entidad'
  } finally {
    creando.value = false
  }
}

async function alternarActiva(id: string, activa: boolean) {
  await actualizarEntidad(id, { activa: !activa })
}

const editandoId = ref<string | null>(null)
const nombreEdicion = ref('')

function empezarEdicion(id: string, nombre: string) {
  editandoId.value = id
  nombreEdicion.value = nombre
}

async function guardarEdicion(id: string) {
  if (!nombreEdicion.value.trim()) return
  await actualizarEntidad(id, { nombre: nombreEdicion.value.trim() })
  editandoId.value = null
}

async function borrar(id: string, nombre: string) {
  if (!confirm(`¿Eliminar la entidad "${nombre}"? Los movimientos ya cargados no se borran.`)) return
  await eliminarEntidad(id)
}
</script>

<template>
  <div class="stack">
    <h1>Entidades</h1>
    <p class="text-muted">
      Proveedores, socios y demás entidades que aparecen como opciones en la carga rápida.
      Se ordenan automáticamente por frecuencia de uso; aquí puedes editar la lista manualmente.
    </p>

    <form class="card row" @submit.prevent="agregar">
      <input
        v-model="nombreNuevo"
        type="text"
        class="input"
        placeholder="Nombre de la nueva entidad"
      >
      <button type="submit" class="btn btn-primary" :disabled="creando">Agregar</button>
    </form>

    <p v-if="error" class="alert alert-error">{{ error }}</p>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Usos</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!entidadesTodasPorFrecuencia.length">
            <td colspan="4" class="text-muted">Todavía no hay entidades cargadas.</td>
          </tr>
          <tr v-for="e in entidadesTodasPorFrecuencia" :key="e.id">
            <td>
              <input
                v-if="editandoId === e.id"
                v-model="nombreEdicion"
                type="text"
                class="input"
                @keydown.enter="guardarEdicion(e.id)"
              >
              <span v-else>{{ e.nombre }}</span>
            </td>
            <td class="text-muted">{{ usoPorEntidad[e.id] ?? 0 }}</td>
            <td>
              <span class="badge" :class="e.activa ? 'badge-ingreso' : 'badge-egreso'">
                {{ e.activa ? 'activa' : 'inactiva' }}
              </span>
            </td>
            <td class="row acciones">
              <template v-if="editandoId === e.id">
                <button type="button" class="btn btn-primary" @click="guardarEdicion(e.id)">Guardar</button>
                <button type="button" class="btn btn-ghost" @click="editandoId = null">Cancelar</button>
              </template>
              <template v-else>
                <button type="button" class="btn btn-ghost" @click="empezarEdicion(e.id, e.nombre)">Renombrar</button>
                <button type="button" class="btn btn-ghost" @click="alternarActiva(e.id, e.activa)">
                  {{ e.activa ? 'Desactivar' : 'Activar' }}
                </button>
                <button type="button" class="btn btn-ghost btn-danger" @click="borrar(e.id, e.nombre)">Eliminar</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.acciones {
  justify-content: flex-end;
}
</style>
