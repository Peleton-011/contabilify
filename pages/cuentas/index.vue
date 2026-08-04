<script setup lang="ts">
import type { TipoCuenta } from '~/types/schema'

definePageMeta({ middleware: 'admin' })

const { cuentas, fetchCuentas, crearCuenta, actualizarCuenta, eliminarCuenta } = useCuentas()

await fetchCuentas(false)

const nuevo = reactive({
  nombre: '',
  tipo: 'otro' as TipoCuenta,
  saldoInicialTexto: '',
})
const creando = ref(false)
const error = ref<string | null>(null)

async function agregar() {
  if (!nuevo.nombre.trim()) return

  const saldoInicial = nuevo.saldoInicialTexto.trim() ? parseMonto(nuevo.saldoInicialTexto) : 0
  if (!Number.isFinite(saldoInicial)) {
    error.value = 'El saldo inicial no es un número válido'
    return
  }

  creando.value = true
  error.value = null
  try {
    await crearCuenta({
      nombre: nuevo.nombre.trim(),
      tipo: nuevo.tipo,
      saldo_inicial: saldoInicial,
      orden: cuentas.value.length + 1,
    })
    nuevo.nombre = ''
    nuevo.saldoInicialTexto = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo crear la cuenta'
  } finally {
    creando.value = false
  }
}

async function alternarActiva(id: string, activa: boolean) {
  await actualizarCuenta(id, { activa: !activa })
}

async function borrar(id: string, nombre: string) {
  if (
    !confirm(
      `¿Eliminar la cuenta "${nombre}"? Si tiene movimientos cargados, esto fallará: desactívala en su lugar.`
    )
  )
    return
  try {
    await eliminarCuenta(id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'No se pudo eliminar la cuenta'
  }
}
</script>

<template>
  <div class="stack">
    <h1>Cuentas</h1>
    <p class="text-muted">
      Cajas, bancos u otras cuentas sobre las que se registran ingresos y egresos. El saldo
      inicial se suma a los movimientos para calcular el saldo actual.
    </p>

    <form class="card cuenta-form" @submit.prevent="agregar">
      <div class="field">
        <label for="c-nombre">Nombre</label>
        <input id="c-nombre" v-model="nuevo.nombre" type="text" class="input" placeholder="Ej. Caja chica">
      </div>
      <div class="field">
        <label for="c-tipo">Tipo</label>
        <select id="c-tipo" v-model="nuevo.tipo" class="input">
          <option value="efectivo">Efectivo</option>
          <option value="banco">Banco</option>
          <option value="otro">Otro</option>
        </select>
      </div>
      <div class="field">
        <label for="c-saldo">Saldo inicial</label>
        <input
          id="c-saldo"
          v-model="nuevo.saldoInicialTexto"
          type="text"
          inputmode="decimal"
          placeholder="0,00"
          class="input"
        >
      </div>
      <button type="submit" class="btn btn-primary" :disabled="creando">Agregar cuenta</button>
    </form>

    <p v-if="error" class="alert alert-error">{{ error }}</p>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Tipo</th>
            <th>Saldo inicial</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in cuentas" :key="c.id">
            <td>{{ c.nombre }}</td>
            <td>{{ c.tipo }}</td>
            <td>{{ formatoMonto(c.saldo_inicial) }}</td>
            <td>
              <span class="badge" :class="c.activa ? 'badge-ingreso' : 'badge-egreso'">
                {{ c.activa ? 'activa' : 'inactiva' }}
              </span>
            </td>
            <td class="row acciones">
              <button type="button" class="btn btn-ghost" @click="alternarActiva(c.id, c.activa)">
                {{ c.activa ? 'Desactivar' : 'Activar' }}
              </button>
              <button type="button" class="btn btn-ghost btn-danger" @click="borrar(c.id, c.nombre)">
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.cuenta-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  align-items: end;
}

.acciones {
  justify-content: flex-end;
}
</style>
