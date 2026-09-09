<script setup lang="ts">
const { ledgers, pending, error, fetchLedgers, crearLedger, seleccionar, ledgerActivoId } = useLedgers()
const router = useRouter()

await fetchLedgers()

const nombreNuevo = ref('')
const creando = ref(false)
const errorCreando = ref<string | null>(null)

async function crear() {
  if (!nombreNuevo.value.trim()) return
  creando.value = true
  errorCreando.value = null
  try {
    await crearLedger(nombreNuevo.value)
    nombreNuevo.value = ''
    router.push('/')
  } catch (err) {
    errorCreando.value = err instanceof Error ? err.message : 'No se pudo crear el ledger'
  } finally {
    creando.value = false
  }
}

function elegir(id: string) {
  seleccionar(id)
  router.push('/')
}
</script>

<template>
  <div class="stack ledgers-stack">
    <h1>Tus ledgers</h1>
    <p class="text-muted">
      Cada ledger es una organización contable independiente, con sus propias cuentas,
      entidades y movimientos. Elige uno para entrar o crea uno nuevo.
    </p>

    <p v-if="error" class="alert alert-error">{{ error }}</p>

    <p v-if="pending && !ledgers.length" class="card text-muted">Cargando…</p>

    <div v-else-if="ledgers.length" class="grid-balances">
      <button
        v-for="l in ledgers"
        :key="l.id"
        type="button"
        class="card ledger-card"
        :class="{ seleccionada: l.id === ledgerActivoId }"
        @click="elegir(l.id)"
      >
        <span class="ledger-nombre">{{ l.nombre }}</span>
        <span class="badge" :class="l.role === 'admin' ? 'badge-ingreso' : 'badge-egreso'">
          {{ l.role === 'admin' ? 'admin' : 'miembro' }}
        </span>
      </button>
    </div>

    <p v-else class="card text-muted">Todavía no perteneces a ningún ledger.</p>

    <form class="card ledger-form" @submit.prevent="crear">
      <div class="field">
        <label for="l-nombre">Crear un ledger nuevo</label>
        <input
          id="l-nombre"
          v-model="nombreNuevo"
          type="text"
          class="input"
          placeholder="Ej. Mi negocio"
        >
      </div>
      <p v-if="errorCreando" class="alert alert-error">{{ errorCreando }}</p>
      <button type="submit" class="btn btn-primary" :disabled="creando">Crear ledger</button>
    </form>
  </div>
</template>

<style scoped>
.ledgers-stack {
  max-width: 640px;
}

.ledger-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.ledger-card:hover {
  border-color: var(--color-primary);
}

.ledger-card.seleccionada {
  border-color: var(--color-primary);
  border-width: 2px;
  background: color-mix(in oklch, var(--color-primary) 8%, var(--color-surface));
}

.ledger-nombre {
  font-family: var(--font-body);
  font-size: 1.15rem;
  font-weight: 700;
}

.ledger-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-start;
}
</style>
