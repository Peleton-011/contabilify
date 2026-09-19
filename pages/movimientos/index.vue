<script setup lang="ts">
import type { MovimientoConRelaciones } from "~/types/schema";

const { isAdminActivo: isAdmin } = useLedgers();
const {
	movimientos,
	fetchMovimientos,
	actualizarMovimiento,
	eliminarMovimiento,
	crearMovimiento,
	pending,
} = useMovimientos();
const { cuentas, fetchCuentas } = useCuentas();
const { entidadesActivas, fetchEntidades } = useEntidades();
const { entradasSalidas, fetchEntradasSalidas } = useEntradasSalidas();
const { materializarPendientes } = useMovimientosRecurrentes();
const user = useSupabaseUser();

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
]);

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

const editandoId = ref<string | null>(null);
const edicion = reactive({
	fecha: "",
	tipo: "ingreso" as "ingreso" | "egreso",
	montoTexto: "",
	concepto: "",
	numeroFactura: "",
	entidad_id: "" as string | "",
	cuenta_id: "",
});
const guardandoEdicion = ref(false);
const errorEdicion = ref<string | null>(null);

function empezarEdicion(m: MovimientoConRelaciones) {
	editandoId.value = m.id;
	edicion.fecha = m.fecha;
	edicion.tipo = m.tipo;
	edicion.montoTexto = String(m.monto);
	edicion.concepto = m.concepto;
	edicion.numeroFactura = m.numero_factura ?? "";
	edicion.entidad_id = m.entidad_id ?? "";
	edicion.cuenta_id = m.cuenta_id;
	errorEdicion.value = null;
}

function cancelarEdicion() {
	editandoId.value = null;
	errorEdicion.value = null;
}

async function guardarEdicion(id: string) {
	const fechaNormalizada = normalizarFecha(edicion.fecha);
	if (!fechaNormalizada) {
		errorEdicion.value = "La fecha no es válida";
		return;
	}
	const monto = parseMonto(edicion.montoTexto);
	if (!(monto > 0)) {
		errorEdicion.value = "El monto debe ser mayor a cero";
		return;
	}
	if (!edicion.concepto.trim()) {
		errorEdicion.value = "El concepto no puede estar vacío";
		return;
	}

	guardandoEdicion.value = true;
	errorEdicion.value = null;
	try {
		await actualizarMovimiento(id, {
			fecha: fechaNormalizada,
			tipo: edicion.tipo,
			monto,
			concepto: edicion.concepto.trim(),
			numero_factura: edicion.numeroFactura.trim() || null,
			entidad_id: edicion.entidad_id || null,
			cuenta_id: edicion.cuenta_id,
		});
		editandoId.value = null;
		await aplicarFiltros();
	} catch (err) {
		errorEdicion.value =
			err instanceof Error ? err.message : "No se pudo guardar";
	} finally {
		guardandoEdicion.value = false;
	}
}

const creando = ref(false);
const errorCreando = ref<string | null>(null);
const guardandoCreacion = ref(false);

const creacion = reactive({
	fecha: "",
	tipo: "ingreso" as "ingreso" | "egreso" | undefined,
	montoTexto: "",
	concepto: "",
	numeroFactura: "",
	entidad_id: "" as string | "",
	cuenta_id: "",
});

function empezarCrearMovimiento() {
	creando.value = true;
	creacion.fecha = "";
	creacion.tipo = undefined;
	creacion.montoTexto = "";
	creacion.concepto = "";
	creacion.numeroFactura = "";
	creacion.entidad_id = "";
	creacion.cuenta_id = "s";
	errorCreando.value = null;
}

function cancelarCreacion() {
	creando.value = false;
	errorCreando.value = "";
}

async function guardarCreacion() {
	const fechaNormalizada = normalizarFecha(creacion.fecha);
	if (!fechaNormalizada) {
		errorCreando.value = "La fecha no es válida";
		return;
	}
	const monto = parseMonto(creacion.montoTexto);
	if (!(monto > 0)) {
		errorCreando.value = "El monto debe ser mayor a cero";
		return;
	}
	if (!creacion.concepto.trim()) {
		errorCreando.value = "El concepto no puede estar vacío";
		return;
	}
	if (!(creacion.tipo as "egreso" | "ingreso")) {
		errorCreando.value = "El tipo no puede estar vacío";
		return;
	}

	guardandoCreacion.value = true;
	errorCreando.value = null;
	try {
		await crearMovimiento({
			fecha: fechaNormalizada,
			tipo: creacion.tipo as "egreso" | "ingreso",
			monto,
			concepto: creacion.concepto.trim(),
			numero_factura: creacion.numeroFactura.trim() || null,
			entidad_id: creacion.entidad_id || null,
			cuenta_id: creacion.cuenta_id,
			created_by: user.value?.id ?? null,
			notas: null,
			metadata: {},
		});
		creando.value = false;
		await aplicarFiltros();
	} catch (err) {
		errorCreando.value =
			err instanceof Error ? err.message : "No se pudo guardar";
	} finally {
		guardandoCreacion.value = false;
	}
}

async function borrar(m: MovimientoConRelaciones) {
	const avisoTransferencia = m.metadata?.transferencia_id
		? " Es una transferencia entre cuentas: la otra mitad no se borra automáticamente, tendrás que eliminarla aparte."
		: "";
	if (
		!confirm(
			`¿Eliminar el movimiento "${m.concepto}" por ${formatoMonto(m.monto)}?${avisoTransferencia}`,
		)
	)
		return;
	await eliminarMovimiento(m.id);
	await aplicarFiltros();
}
</script>

<template>
	<div class="stack">
		<h1>Movimientos</h1>

		<section class="grid-balances">
			<IncomeExpenseCard
				:entradasSalidas="entradasSalidas"
				nombre="Cómputo selección actual"
				:seleccionable="false"
			/>
		</section>
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
					<select
						id="f-cuenta"
						v-model="filtros.cuentaId"
						class="input"
					>
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
				<button
					type="button"
					class="btn btn-ghost"
					@click="limpiarFiltros"
				>
					Limpiar
				</button>
			</div>
		</form>

		<div v-if="cuentas.length" class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th>Fecha</th>
						<th>Tipo</th>
						<th>Concepto</th>
						<th>Nº factura</th>
						<th>Entidad</th>
						<th>Cuenta</th>
						<th>Monto</th>
						<th v-if="isAdmin" class="flex justify-end">
							<button
								type="button"
								class="btn btn-primary"
								:disabled="creando"
								@click="empezarCrearMovimiento()"
							>
								Añadir
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					<tr v-if="pending">
						<td colspan="8" class="text-muted">Cargando…</td>
					</tr>
					<tr v-else-if="!movimientos.length">
						<td colspan="8" class="text-muted">
							No hay movimientos con estos filtros.
						</td>
					</tr>

					<tr v-if="creando" class="fila-edicion">
						<td>
							<input
								v-model="creacion.fecha"
								type="text"
								class="input"
								placeholder="aaaa-mm-dd"
							/>
						</td>
						<td>
							<select v-model="creacion.tipo" class="input">
								<option value="ingreso">Ingreso</option>
								<option value="egreso">Egreso</option>
							</select>
						</td>
						<td>
							<input
								v-model="creacion.concepto"
								type="text"
								class="input"
							/>
						</td>
						<td>
							<input
								v-model="creacion.numeroFactura"
								type="text"
								class="input"
							/>
						</td>
						<td>
							<select v-model="creacion.entidad_id" class="input">
								<option value="">Sin entidad</option>
								<option
									v-for="e in entidadesActivas"
									:key="e.id"
									:value="e.id"
								>
									{{ e.nombre }}
								</option>
							</select>
						</td>
						<td>
							<select v-model="creacion.cuenta_id" class="input">
								<option
									v-for="c in cuentas"
									:key="c.id"
									:value="c.id"
								>
									{{ c.nombre }}
								</option>
							</select>
						</td>
						<td>
							<input
								v-model="creacion.montoTexto"
								type="text"
								inputmode="decimal"
								class="input"
							/>
						</td>
						<td class="row acciones">
							<button
								type="button"
								class="btn btn-danger"
								@click="cancelarCreacion"
							>
								Cancelar
							</button>
							<button
								type="button"
								class="btn btn-primary"
								:disabled="guardandoCreacion"
								@click="guardarCreacion()"
							>
								Guardar
							</button>
						</td>
					</tr>

					<template v-for="m in movimientos" :key="m.id">
						<tr v-if="editandoId !== m.id">
							<td>{{ m.fecha }}</td>
							<td>
								<span
									class="badge"
									:class="
										m.tipo === 'ingreso'
											? 'badge-ingreso'
											: 'badge-egreso'
									"
								>
									{{ m.tipo }}
								</span>
							</td>
							<td>
								{{ m.concepto }}
								<span
									v-if="m.metadata?.transferencia_id"
									class="badge badge-transferencia"
									>transferencia</span
								>
							</td>
							<td>{{ m.numero_factura ?? "—" }}</td>
							<td>{{ m.entidad?.nombre ?? "—" }}</td>
							<td>{{ m.cuenta.nombre }}</td>
							<td
								:class="
									m.tipo === 'ingreso'
										? 'text-ingreso'
										: 'text-egreso'
								"
							>
								{{ formatoMonto(m.monto) }}
							</td>
							<td v-if="isAdmin" class="row acciones">
								<button
									type="button"
									class="btn btn-ghost"
									@click="empezarEdicion(m)"
								>
									Editar
								</button>
								<button
									type="button"
									class="btn btn-ghost btn-danger"
									@click="borrar(m)"
								>
									Eliminar
								</button>
							</td>
						</tr>

						<tr v-else class="fila-edicion">
							<td>
								<input
									v-model="edicion.fecha"
									type="text"
									class="input"
									placeholder="aaaa-mm-dd"
								/>
							</td>
							<td>
								<select v-model="edicion.tipo" class="input">
									<option value="ingreso">Ingreso</option>
									<option value="egreso">Egreso</option>
								</select>
							</td>
							<td>
								<input
									v-model="edicion.concepto"
									type="text"
									class="input"
								/>
							</td>
							<td>
								<input
									v-model="edicion.numeroFactura"
									type="text"
									class="input"
								/>
							</td>
							<td>
								<select
									v-model="edicion.entidad_id"
									class="input"
								>
									<option value="">Sin entidad</option>
									<option
										v-for="e in entidadesActivas"
										:key="e.id"
										:value="e.id"
									>
										{{ e.nombre }}
									</option>
								</select>
							</td>
							<td>
								<select
									v-model="edicion.cuenta_id"
									class="input"
								>
									<option
										v-for="c in cuentas"
										:key="c.id"
										:value="c.id"
									>
										{{ c.nombre }}
									</option>
								</select>
							</td>
							<td>
								<input
									v-model="edicion.montoTexto"
									type="text"
									inputmode="decimal"
									class="input"
								/>
							</td>
							<td class="row acciones">
								<button
									type="button"
									class="btn btn-primary"
									:disabled="guardandoEdicion"
									@click="guardarEdicion(m.id)"
								>
									Guardar
								</button>
								<button
									type="button"
									class="btn btn-ghost"
									@click="cancelarEdicion"
								>
									Cancelar
								</button>
							</td>
						</tr>
					</template>
				</tbody>
			</table>
		</div>
		<p v-else class="card text-muted">
			Aún no hay ninguna cuenta en este ledger
			<NuxtLink to="/cuentas">Cuentas</NuxtLink>.
		</p>

		<p v-if="errorEdicion" class="alert alert-error">{{ errorEdicion }}</p>
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
