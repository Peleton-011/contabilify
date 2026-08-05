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

    <p v-if="!cuentas.length" class="card text-muted">Todavía no hay cuentas cargadas.</p>

    <div v-else class="grid-balances">
      <div
        v-for="c in cuentas"
        :key="c.id"
        class="card cuenta-card"
        :class="{ inactiva: !c.activa }"
      >
        <div class="row cuenta-card-header">
          <h3 class="cuenta-nombre">{{ c.nombre }}</h3>
          <span class="badge" :class="c.activa ? 'badge-ingreso' : 'badge-egreso'">
            {{ c.activa ? 'activa' : 'inactiva' }}
          </span>
        </div>
        <span class="cuenta-tipo text-muted">{{ c.tipo }}</span>

        <div class="cuenta-saldo-wrap">
          <span class="text-muted cuenta-saldo-label">Saldo inicial</span>
          <span class="cuenta-saldo">{{ formatoMonto(c.saldo_inicial) }}</span>
        </div>

        <div class="row acciones">
          <button type="button" class="btn btn-ghost" @click="alternarActiva(c.id, c.activa)">
            {{ c.activa ? 'Desactivar' : 'Activar' }}
          </button>
          <span class="spacer" />
          <button type="button" class="btn btn-ghost btn-danger" @click="borrar(c.id, c.nombre)">
            Eliminar
          </button>
        </div>
      </div>
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

.cuenta-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.cuenta-card.inactiva {
  opacity: 0.6;
}

.cuenta-card-header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.cuenta-nombre {
  margin: 0;
  font-size: 1.1rem;
}

.cuenta-tipo {
  font-size: 0.8rem;
  text-transform: capitalize;
  letter-spacing: 0.03em;
}

.cuenta-saldo-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin: 0.35rem 0 0.5rem;
  padding-top: 0.6rem;
  border-top: 1px dotted var(--color-border);
}

.cuenta-saldo-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cuenta-saldo {
  font-family: var(--font-body);
  font-size: 1.4rem;
  font-weight: 800;
}

.acciones {
  margin-top: auto;
}
</style>
