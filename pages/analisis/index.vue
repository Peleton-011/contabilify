<script setup lang="ts">
import ComboChart from "@/components/ui/charts/combo-chart/ComboChart.vue";

import type { MovimientoConRelaciones } from "~/types/schema";

const { isAdminActivo: isAdmin } = useLedgers();
const {
	movimientos,
	fetchMovimientos,
	actualizarMovimiento,
	eliminarMovimiento,
	pending,
} = useMovimientos();
const { cuentas, fetchCuentas } = useCuentas();
const { entidadesActivas, fetchEntidades } = useEntidades();
const { entradasSalidas, fetchEntradasSalidas } = useEntradasSalidas();
const { materializarPendientes } = useMovimientosRecurrentes();
const {
	balanceInicial,
	saldos,
	saldoTotal,
	fetchBalanceInicial,
	fetchSaldoEn,
} = useSaldos();

interface Brutos {
	nombre: string;
	list: {
		m: string;
		ingresos: number;
		egresos: number;
		balance: number;
	}[];
	cuenta_id: string;
}

const netos = ref<{ m: string; neto: number; balance: number }[]>([]);
const brutos = ref<Brutos[]>([]);

const span = ref<"custom" | "month" | "year">("custom");

watch(span, (newVal) => {
	if (newVal !== "custom") {
		aplicarHasta();
	}
});

const filtros = reactive({
	desde: "",
	hasta: "",
	tipo: "" as "" | "ingreso" | "egreso",
	cuentaId: "",
	entidadId: "",
	texto: "",
});

await materializarPendientes();
await Promise.all([
	fetchCuentas(false),
	fetchEntidades(),
	aplicarFiltros(),
	fetchEntradasSalidas(),
	,
]);
calcularBrutos();

function nextDate(currentDate: string, dias: number) {
	if (dias <= 90) {
		return sumarDias(currentDate, 1);
	} else if (dias > 90) {
		return sumarMeses(currentDate, 1);
	}
	return currentDate;
}
function calcularBrutos() {
	brutos.value = [];
	const desde =
		filtros.desde || movimientos.value[movimientos.value.length - 1].fecha;
	const hasta = filtros.hasta || movimientos.value[0].fecha;
	const periodo = { desde: isoToDate(desde)!, hasta: isoToDate(hasta)! };
	const dias = Math.abs(
		periodo.hasta.getFullYear() * 365 +
			periodo.hasta.getMonth() * 30 +
			periodo.hasta.getDate() -
			(periodo.desde.getFullYear() * 365 +
				periodo.desde.getMonth() * 30 +
				periodo.desde.getDate()),
	);

	const brutosTotal: Brutos = {
		nombre: "Total",
		list: [],
		cuenta_id: "",
	};
	// Calcular para cada cuenta
	cuentas.value.forEach((cuenta, i) => {
		const brutosCuenta: Brutos = {
			cuenta_id: cuenta.id,
			nombre: cuenta.nombre,
			list: [],
		};
		let balance = balanceInicial.value[i];

		let currentDate = nextDate(desde, dias);
		let lastDate = desde;
		while (currentDate <= hasta) {
			const ingresos = movimientos.value
				.filter(
					(m) =>
						m.tipo === "ingreso" &&
						m.fecha <= currentDate &&
						m.fecha > lastDate &&
						m.cuenta_id === cuenta.id,
				)
				.reduce((acc, m) => acc + m.monto, 0);
			const egresos = movimientos.value
				.filter(
					(m) =>
						m.tipo === "egreso" &&
						m.fecha <= currentDate &&
						m.fecha > lastDate &&
						m.cuenta_id === cuenta.id,
				)
				.reduce((acc, m) => acc + m.monto, 0);
			balance += ingresos;
			balance -= egresos;

			brutosCuenta.list.push({
				m: lastDate,
				ingresos,
				egresos,
				balance: balance,
			});

			if (brutosTotal.list.length < brutosCuenta.list.length) {
				brutosTotal.list.push({
					m: lastDate,
					ingresos,
					egresos,
					balance: balance,
				});
			} else {
				brutosTotal.list[brutosCuenta.list.length - 1].ingresos +=
					ingresos;
				brutosTotal.list[brutosCuenta.list.length - 1].egresos +=
					egresos;
				brutosTotal.list[brutosCuenta.list.length - 1].balance +=
					balance;
			}

			lastDate = currentDate;
			currentDate = nextDate(currentDate, dias);
		}
		brutos.value.push(brutosCuenta);
	});

	brutos.value.push(brutosTotal);
}

async function aplicarFiltros() {
	await fetchMovimientos({
		desde: filtros.desde || undefined,
		hasta: filtros.hasta || undefined,
		tipo: filtros.tipo || null,
		cuentaId: filtros.cuentaId || null,
		entidadId: filtros.entidadId || null,
		texto: filtros.texto || undefined,
	});
	await fetchEntradasSalidas({
		desde: filtros.desde || undefined,
		hasta: filtros.hasta || undefined,
		cuentaId: filtros.cuentaId || null,
		entidadId: filtros.entidadId || null,
		texto: filtros.texto || undefined,
	});
	await fetchBalanceInicial({
		desde: filtros.desde || undefined,
		hasta: filtros.hasta || undefined,
		cuentaId: filtros.cuentaId || null,
		entidadId: filtros.entidadId || null,
		texto: filtros.texto || undefined,
	});
	console.log(movimientos.value);
	calcularBrutos();
}

function limpiarFiltros() {
	filtros.desde = "";
	filtros.hasta = "";
	filtros.tipo = "";
	filtros.cuentaId = "";
	filtros.entidadId = "";
	filtros.texto = "";
	aplicarFiltros();
}

function aplicarHasta() {
	if (filtros.desde) {
		const fecha = new Date(filtros.desde);
		if (span.value === "month") {
			fecha.setMonth(fecha.getMonth() + 1);
			fecha.setDate(0); // último día del mes
		} else if (span.value === "year") {
			fecha.setFullYear(fecha.getFullYear() + 1);
			fecha.setDate(0); // último día del año
		}
		filtros.hasta = fecha.toISOString().split("T")[0];
	}
}

netos.value = [
	{ m: "Jan", neto: 320, balance: 2.1 },
	{ m: "Feb", neto: 410, balance: -2.4 },
	{ m: "Mar", neto: 380, balance: 2.2 },
	{ m: "Apr", neto: -520, balance: 2.9 },
	{ m: "May", neto: 480, balance: 2.7 },
	{ m: "Jun", neto: 610, balance: 3.4 },
	{ m: "Ini 1", neto: balanceInicial.value?.[0], balance: 0 },
	{ m: "Ini 2", neto: balanceInicial.value?.[1], balance: 0 },
	{ m: "Ini 3", neto: balanceInicial.value?.[2], balance: 0 },
];
</script>

<template>
	<form class="card filtros" @submit.prevent="aplicarFiltros">
		<div class="filtros-grid">
			<div class="field">
				<label for="f-desde">Desde</label>
				<input
					id="f-desde"
					v-model="filtros.desde"
					type="date"
					class="input"
					@change="aplicarHasta()"
				/>
			</div>
			<div class="field">
				<label for="f-hasta">Hasta</label>
				<input
					id="f-hasta"
					v-model="filtros.hasta"
					type="date"
					class="input"
					:disabled="span === 'month' || span === 'year'"
				/>
			</div>
			<div class="field" id="lapse">
				<label for="lapse">Seleccionar por:</label>
				<div class="radio">
					<label for="f-sel-cus">Custom</label>
					<input
						id="f-sel-cus"
						v-model="span"
						type="radio"
						class="input"
						value="custom"
					/>
				</div>
				<div class="radio">
					<label for="f-sel-mon">Mes</label>
					<input
						id="f-sel-mon"
						v-model="span"
						type="radio"
						class="input"
						value="month"
					/>
				</div>
				<div class="radio">
					<label for="f-sel-yea">Año</label>
					<input
						id="f-sel-yea"
						v-model="span"
						type="radio"
						class="input"
						value="year"
					/>
				</div>
			</div>
			<div class="field">
				<label for="f-tipo">Tipo</label>
				<select id="f-tipo" v-model="filtros.tipo" class="input">
					<option value="">Todos</option>
					<option value="ingreso">Ingreso</option>
					<option value="egreso">Egreso</option>
				</select>
			</div>
			<div class="field">
				<label for="f-cuenta">Cuenta</label>
				<select id="f-cuenta" v-model="filtros.cuentaId" class="input">
					<option value="">Todas</option>
					<option v-for="c in cuentas" :key="c.id" :value="c.id">
						{{ c.nombre }}
					</option>
				</select>
			</div>
			<div class="field">
				<label for="f-entidad">Entidad</label>
				<select
					id="f-entidad"
					v-model="filtros.entidadId"
					class="input"
				>
					<option value="">Todas</option>
					<option
						v-for="e in entidadesActivas"
						:key="e.id"
						:value="e.id"
					>
						{{ e.nombre }}
					</option>
				</select>
			</div>
			<div class="field">
				<label for="f-texto">Buscar en concepto</label>
				<input
					id="f-texto"
					v-model="filtros.texto"
					type="text"
					class="input"
					placeholder="Ej. alquiler"
				/>
			</div>
		</div>

		<div class="row">
			<button type="submit" class="btn btn-primary">Filtrar</button>
			<button type="button" class="btn btn-ghost" @click="limpiarFiltros">
				Limpiar
			</button>
		</div>
	</form>

	<div class="card">
		<span class="balance-nombre text-muted">Neto</span>
		<ComboChart
			:data="netos"
			x-field="m"
			bar-field="neto"
			line-field="balance"
			height="320"
		/>
	</div>

	<div class="card">
		<span class="balance-nombre text-muted">Ingresos vs Egresos</span>
		<ComboChart
			v-for="b in brutos"
			:data="b.list"
			:key="b.nombre"
			x-field="m"
			:bar-field="['ingresos', 'egresos']"
			line-field="balance"
			height="300"
		/>
	</div>

	<div class="card">
		<span class="balance-nombre text-muted">Ingresos vs Egresos</span>
	</div>
</template>

<style scoped>
.radio {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding-right: 2rem;
}
.radio > input {
	width: min-content;
}
.filtros-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
	gap: 0.85rem;
	margin-bottom: 1rem;
}
.input:disabled {
	cursor: not-allowed;
	color: var(--color-text-muted);
}
.acciones {
	justify-content: flex-end;
}

.fila-edicion td {
	background: color-mix(in oklch, var(--color-primary) 6%, transparent);
}
</style>
