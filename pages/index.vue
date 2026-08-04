<script setup lang="ts">
const { isAdmin } = useProfile()
const { saldos, saldoTotal, fetchSaldos } = useSaldos()
const { movimientos, fetchMovimientos } = useMovimientos()

await Promise.all([fetchSaldos(), fetchMovimientos({}, 6)])

async function refrescar() {
  await Promise.all([fetchSaldos(), fetchMovimientos({}, 6)])
}
</script>

<template>
  <div class="stack">
    <section class="grid-balances">
      <BalanceCard
        v-for="s in saldos"
        :key="s.cuenta_id"
        :nombre="s.nombre"
        :saldo="s.saldo_actual"
      />
      <BalanceCard nombre="Total" :saldo="saldoTotal" destacado />
    </section>

    <QuickEntry v-if="isAdmin" @guardado="refrescar" />
    <p v-else class="card text-muted">
      Solo los administradores pueden cargar movimientos. Puedes ver el detalle en
      <NuxtLink to="/movimientos">Movimientos</NuxtLink>.
    </p>

    <section class="card">
      <div class="row">
        <h2 class="section-title">Últimos movimientos</h2>
        <span class="spacer" />
        <NuxtLink to="/movimientos" class="btn btn-ghost">Ver todos</NuxtLink>
      </div>

      <p v-if="!movimientos.length" class="text-muted">Todavía no hay movimientos cargados.</p>

      <ul v-else class="ultimos-list">
        <li v-for="m in movimientos" :key="m.id" class="row ultimo-item">
          <span class="badge" :class="m.tipo === 'ingreso' ? 'badge-ingreso' : 'badge-egreso'">
            {{ m.tipo }}
          </span>
          <span class="ultimo-concepto">{{ m.concepto }}</span>
          <span class="text-muted ultimo-entidad">{{ m.entidad?.nombre ?? '' }}</span>
          <span class="spacer" />
          <span class="text-muted">{{ m.cuenta.nombre }}</span>
          <span :class="m.tipo === 'ingreso' ? 'text-ingreso' : 'text-egreso'">
            {{ formatoMonto(m.monto) }}
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.section-title {
  margin: 0;
  font-size: 1.05rem;
}

.ultimos-list {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.ultimo-item {
  flex-wrap: wrap;
  font-size: 0.9rem;
  padding-bottom: 0.6rem;
  border-bottom: 1px solid var(--color-border);
}

.ultimo-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.ultimo-concepto {
  font-weight: 600;
}

.ultimo-entidad {
  font-size: 0.85rem;
}
</style>
