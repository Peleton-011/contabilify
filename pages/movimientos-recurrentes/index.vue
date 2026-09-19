<script setup lang="ts">
import type {
	Entidad,
	MetodoRedondeo,
	MovimientoRecurrenteConRelaciones,
	PeriodoRecurrencia,
	TipoMovimiento,
} from "~/types/schema";

definePageMeta({ middleware: "admin" });

const {
	reglas,
	desactualizados,
	fetchReglas,
	crearRegla,
	actualizarRegla,
	eliminarRegla,
	materializarPendientes,
	fetchDesactualizados,
} = useMovimientosRecurrentes();
const { cuentas, fetchCuentas } = useCuentas();
const { entidadesPorFrecuencia, fetchEntidades } = useEntidades();
const user = useSupabaseUser();

await Promise.all([
	fetchReglas(),
	fetchCuentas(),
	fetchEntidades(),
	fetchDesactualizados(),
]);

const PERIODOS: { value: PeriodoRecurrencia; label: string }[] = [
	{ value: "diaria", label: "Diaria" },
	{ value: "semanal", label: "Semanal" },
	{ value: "quincenal", label: "Quincenal" },
	{ value: "mensual", label: "Mensual" },
	{ value: "bimestral", label: "Bimestral" },
	{ value: "trimestral", label: "Trimestral" },
	{ value: "semestral", label: "Semestral" },
	{ value: "anual", label: "Anual" },
];

const REDONDEOS: { value: MetodoRedondeo; label: string }[] = [
	{ value: "matematico", label: "Matemático" },
	{ value: "piso", label: "Hacia abajo" },
	{ value: "techo", label: "Hacia arriba" },
];

const nuevo = reactive({
	concepto: "",
	tipo: "egreso" as TipoMovimiento,
	cuentaId: "",
	entidadId: null as string | null,
	montoFijoTexto: "",
	usaDinamico: false,
	porcentajeTexto: "",
	baseCalculo: "promedio" as "inicio" | "promedio" | "fin",
	tasaPeriodo: "anual" as PeriodoRecurrencia,
	redondeo: "matematico" as MetodoRedondeo,
	operacionPeriodo: "mensual" as PeriodoRecurrencia,
	fechaInicio: new Date().toISOString().slice(0, 10),
	fechaFin: "",
});

const empty = {
	concepto: "",
	tipo: "egreso" as TipoMovimiento,
	cuentaId: "",
	entidadId: null as string | null,
	montoFijoTexto: "",
	usaDinamico: false,
	porcentajeTexto: "",
	baseCalculo: "promedio" as "inicio" | "promedio" | "fin",
	tasaPeriodo: "anual" as PeriodoRecurrencia,
	redondeo: "matematico" as MetodoRedondeo,
	operacionPeriodo: "mensual" as PeriodoRecurrencia,
	fechaInicio: new Date().toISOString().slice(0, 10),
	fechaFin: "",
};

const creando = ref(false);
const errorCreando = ref<string | null>(null);

const editandoId = ref<string | null>(null);

const mostrandoDetallesId = ref<string | null>(null);

// Source - https://stackoverflow.com/a/60738940
// Posted by kanine, modified by community. See post 'Timeline' for change history
// Retrieved 2026-09-19, License - CC BY-SA 4.0

function camelize(s: string) {
	return s.replace(/_./g, (x) => x[1].toUpperCase());
}

function camelizeObject(o: { [key: string]: any }) {
	const newObject: { [key: string]: any } = {};
	for (const [k, v] of Object.entries(o)) {
		newObject[camelize(k)] = v;
	}
	return newObject;
}

function onEntidadSeleccionada(entidad: Entidad | null) {
	nuevo.entidadId = entidad?.id ?? null;
}

function onSubmit() {
	if (!editandoId.value) {
		agregar();
	} else {
		guardarEdicion(editandoId.value);
	}
}

async function agregar() {
	errorCreando.value = null;
	if (!nuevo.concepto.trim() || !nuevo.cuentaId) {
		errorCreando.value = "Completa el concepto y la cuenta";
		return;
	}

	const montoFijo = nuevo.montoFijoTexto.trim()
		? parseMonto(nuevo.montoFijoTexto)
		: 0;
	if (!Number.isFinite(montoFijo)) {
		errorCreando.value = "El monto fijo no es un número válido";
		return;
	}

	let porcentaje: number | null = null;
	if (nuevo.usaDinamico) {
		const valor = nuevo.porcentajeTexto.trim()
			? parseMonto(nuevo.porcentajeTexto)
			: NaN;
		if (!Number.isFinite(valor)) {
			errorCreando.value = "El porcentaje no es un número válido";
			return;
		}
		porcentaje = valor / 100;
	}

	if (!montoFijo && !nuevo.usaDinamico) {
		errorCreando.value =
			"Necesita un monto fijo, una parte dinámica, o ambas";
		return;
	}

	creando.value = true;
	try {
		await crearRegla({
			cuenta_id: nuevo.cuentaId,
			entidad_id: nuevo.entidadId,
			tipo: nuevo.tipo,
			concepto: nuevo.concepto.trim(),
			monto_fijo: montoFijo,
			usa_dinamico: nuevo.usaDinamico,
			porcentaje,
			base_calculo: nuevo.usaDinamico ? nuevo.baseCalculo : null,
			tasa_periodo: nuevo.usaDinamico ? nuevo.tasaPeriodo : null,
			redondeo: nuevo.redondeo,
			operacion_periodo: nuevo.operacionPeriodo,
			fecha_inicio: nuevo.fechaInicio,
			fecha_fin: nuevo.fechaFin || null,
			activo: true,
			created_by: user.value?.id ?? null,
		});
		nuevo.concepto = "";
		nuevo.montoFijoTexto = "";
		nuevo.porcentajeTexto = "";
		nuevo.usaDinamico = false;
		nuevo.entidadId = null;
	} catch (err) {
		errorCreando.value =
			err instanceof Error ? err.message : "No se pudo crear la regla";
	} finally {
		creando.value = false;
	}
}

function empezarEdicion(mr: MovimientoRecurrenteConRelaciones) {
	editandoId.value = mr.id;
	mostrandoDetallesId.value = null;
	Object.assign(nuevo, camelizeObject(mr));
	if (mr.monto_fijo) nuevo.montoFijoTexto = String(mr.monto_fijo);
	if (mr.porcentaje) nuevo.porcentajeTexto = String(mr.porcentaje * 100);
}

function cancelarEdicion() {
	editandoId.value = null;
	errorCreando.value = null;
	Object.assign(nuevo, empty);
}

async function guardarEdicion(id: string) {
	errorCreando.value = null;
	if (!nuevo.concepto.trim() || !nuevo.cuentaId) {
		errorCreando.value = "Completa el concepto y la cuenta";
		return;
	}

	const montoFijo = nuevo.montoFijoTexto.trim()
		? parseMonto(nuevo.montoFijoTexto)
		: 0;
	if (!Number.isFinite(montoFijo)) {
		errorCreando.value = "El monto fijo no es un número válido";
		return;
	}

	let porcentaje: number | null = null;
	if (nuevo.usaDinamico) {
		const valor = nuevo.porcentajeTexto.trim()
			? parseMonto(nuevo.porcentajeTexto)
			: NaN;
		if (!Number.isFinite(valor)) {
			errorCreando.value = "El porcentaje no es un número válido";
			return;
		}
		porcentaje = valor / 100;
	}

	if (!montoFijo && !nuevo.usaDinamico) {
		errorCreando.value =
			"Necesita un monto fijo, una parte dinámica, o ambas";
		return;
	}

	creando.value = true;
	try {
		await actualizarRegla(id, {
			cuenta_id: nuevo.cuentaId,
			entidad_id: nuevo.entidadId,
			tipo: nuevo.tipo,
			concepto: nuevo.concepto.trim(),
			monto_fijo: montoFijo,
			usa_dinamico: nuevo.usaDinamico,
			porcentaje,
			base_calculo: nuevo.usaDinamico ? nuevo.baseCalculo : null,
			tasa_periodo: nuevo.usaDinamico ? nuevo.tasaPeriodo : null,
			redondeo: nuevo.redondeo,
			operacion_periodo: nuevo.operacionPeriodo,
			fecha_inicio: nuevo.fechaInicio,
			fecha_fin: nuevo.fechaFin || null,
			activo: true,
			created_by: user.value?.id ?? null,
		});
		nuevo.concepto = "";
		nuevo.montoFijoTexto = "";
		nuevo.porcentajeTexto = "";
		nuevo.usaDinamico = false;
		nuevo.entidadId = null;
		editandoId.value = null;
	} catch (err) {
		errorCreando.value =
			err instanceof Error ? err.message : "No se pudo crear la regla";
	} finally {
		creando.value = false;
	}
}

async function alternarActivo(id: string, activo: boolean) {
	await actualizarRegla(id, { activo: !activo });
}

function abrirDetalles(mr: MovimientoRecurrenteConRelaciones) {
	editandoId.value = null;
	mostrandoDetallesId.value = mr.id;
	Object.assign(nuevo, camelizeObject(mr));
	if (mr.monto_fijo) nuevo.montoFijoTexto = String(mr.monto_fijo);
	if (mr.porcentaje) nuevo.porcentajeTexto = String(mr.porcentaje * 100);
}

function cerrarDetalles() {
	mostrandoDetallesId.value = null;
	Object.assign(nuevo, empty);
}

async function borrar(id: string, concepto: string) {
	if (
		!confirm(
			`¿Eliminar la regla "${concepto}"? Los movimientos que ya generó no se borran.`,
		)
	)
		return;
	editandoId.value = null;
	mostrandoDetallesId.value = null;
	await eliminarRegla(id);
}

const generando = ref(false);
const mensajeGenerar = ref<string | null>(null);

async function generarPendientes() {
	generando.value = true;
	mensajeGenerar.value = null;
	try {
		const cantidad = await materializarPendientes();
		mensajeGenerar.value =
			cantidad > 0
				? `Se generaron ${cantidad} movimiento(s).`
				: "Ya estaba todo al día.";
		await fetchDesactualizados();
	} catch (err) {
		mensajeGenerar.value =
			err instanceof Error ? err.message : "No se pudo generar";
	} finally {
		generando.value = false;
	}
}

function etiquetaPeriodo(p: PeriodoRecurrencia) {
	return PERIODOS.find((x) => x.value === p)?.label ?? p;
}
</script>

<template>
	<div class="stack">
		<h1>Movimientos recurrentes</h1>
		<p class="text-muted">
			Reglas que generan movimientos automáticamente: suscripciones y
			cargos fijos, comisiones o intereses porcentuales, o ambos a la vez.
			Se ponen al día solos cada vez que se abre la app.
		</p>

		<p v-if="desactualizados.length" class="alert alert-error">
			{{ desactualizados.length }} movimiento(s) generado(s) pueden estar
			desactualizados: se cargó algo con fecha dentro de un período que ya
			se había calculado. Revísalos en
			<NuxtLink to="/movimientos">Movimientos</NuxtLink>.
		</p>

		<div class="row">
			<button
				type="button"
				class="btn btn-ghost"
				:disabled="generando"
				@click="generarPendientes"
			>
				{{ generando ? "Generando…" : "Generar pendientes ahora" }}
			</button>
			<span v-if="mensajeGenerar" class="text-muted">{{
				mensajeGenerar
			}}</span>
		</div>

		<div v-if="mostrandoDetallesId" class="card stack recurrente-form">
        <h2>Detalles</h2>
			<div class="summary">
				<div class="row row-wrap">
					<div class="row">
						<span class="text-muted">Concepto</span
						><span class="spacer" /><span>{{
							nuevo.concepto
						}}</span>
					</div>
					<div class="row">
						<span class="text-muted">Tipo</span
						><span class="spacer" /><span
							:class="
								nuevo.tipo === 'ingreso'
									? 'text-ingreso'
									: 'text-egreso'
							"
							>{{
								nuevo.tipo.slice(0, 1).toLocaleUpperCase() +
								nuevo.tipo.slice(1).toLocaleLowerCase()
							}}</span
						>
					</div>
					<div class="row">
						<span class="text-muted">Cuenta</span
						><span class="spacer" /><span>{{
							cuentas.find((c) => c.id === nuevo.cuentaId)?.nombre
						}}</span>
					</div>
				</div>

				<div class="row row-wrap">
					<div class="row">
						<span class="text-muted">Entidad</span
						><span class="spacer" /><span>{{
							nuevo.entidadId
								? entidadesPorFrecuencia.find(
										(e) => e.id === nuevo.entidadId,
									)?.nombre
								: " - "
						}}</span>
					</div>
				</div>

				<div class="row row-wrap">
					<div>
						<div class="row">
							<span class="text-muted">Monto Fijo</span
							><span class="spacer" /><strong>{{
								nuevo.montoFijoTexto || " - "
							}}</strong>
						</div>
						<div class="row">
							<span class="text-muted">Pagado cada</span
							><span class="spacer" /><strong>{{
								PERIODOS.find(
									(p) => p.value === nuevo.operacionPeriodo,
								)?.label || " - "
							}}</strong>
						</div>
					</div>
				</div>

				<div class="row row-wrap">
					<div>
						<div class="row">
							<span class="text-muted">Monto Dinámico</span
							><span class="spacer" /><strong>{{
								nuevo.porcentajeTexto || " - "
							}}</strong>
						</div>
						<div class="row">
							<span class="text-muted">Pagado cada</span
							><span class="spacer" /><strong>{{
								PERIODOS.find(
									(p) => p.value === nuevo.tasaPeriodo,
								)?.label || " - "
							}}</strong>
						</div>
						<div class="row">
							<span class="text-muted"
								>Calculado sobre la base</span
							><span class="spacer" /><strong>{{
								nuevo.baseCalculo
									.slice(0, 1)
									.toLocaleUpperCase() +
								nuevo.baseCalculo.slice(1).toLocaleLowerCase() +
								" del periodo"
							}}</strong>
						</div>
						<div class="row">
							<span class="text-muted">Redondeado</span
							><span class="spacer" /><strong>{{
								REDONDEOS.find(
									(r) => r.value === nuevo.redondeo,
								)?.label || " - "
							}}</strong>
						</div>
					</div>
				</div>

				<div class="row row-wrap">
					<div class="row">
						<span class="text-muted">Fecha de Inicio</span
						><span class="spacer" /><strong>{{
							nuevo.fechaInicio || " - "
						}}</strong>
					</div>

					<div class="row">
						<span class="text-muted">Fecha de Fin</span
						><span class="spacer" /><strong>{{
							nuevo.fechaFin || " - "
						}}</strong>
					</div>
				</div>
			</div>

			<div class="summary-actions-wrapper">
				<div class="summary-actions">
					<button
						type="button"
						class="btn btn-ghost"
						@click="
							empezarEdicion(
								reglas.find(
									(r) => r.id === mostrandoDetallesId,
								)!,
							)
						"
					>
						Editar
					</button>
					<button
						type="button"
						class="btn btn-ghost btn-danger"
						@click="borrar(mostrandoDetallesId, nuevo.concepto)"
					>
						Eliminar
					</button>
					<button
						type="button"
						class="btn btn-primary"
						@click="cerrarDetalles"
					>
						Cerrar detalles
					</button>
				</div>
			</div>
		</div>
		<form
			v-else
			class="card stack recurrente-form"
			@submit.prevent="onSubmit"
		>
        <h2 v-if="editandoId">Editando</h2>
        <h2 v-else>Nuevo</h2>

			<div class="row row-wrap">
				<div class="field">
					<label for="r-concepto">Concepto</label>
					<input
						id="r-concepto"
						v-model="nuevo.concepto"
						type="text"
						class="input"
						placeholder="Ej. Comisión mantenimiento"
					/>
				</div>
				<div class="field">
					<label for="r-tipo">Tipo</label>
					<select id="r-tipo" v-model="nuevo.tipo" class="input">
						<option value="egreso">Egreso</option>
						<option value="ingreso">Ingreso</option>
					</select>
				</div>
				<div class="field">
					<label for="r-cuenta">Cuenta</label>
					<select
						id="r-cuenta"
						v-model="nuevo.cuentaId"
						class="input"
					>
						<option value="" disabled>Elegir cuenta…</option>
						<option v-for="c in cuentas" :key="c.id" :value="c.id">
							{{ c.nombre }}
						</option>
					</select>
				</div>
			</div>

			<div class="field">
				<label>Entidad (opcional)</label>
				<EntitySelect
					v-model="nuevo.entidadId"
					:entidades="entidadesPorFrecuencia"
					@seleccionada="onEntidadSeleccionada"
				/>
			</div>

			<div class="row row-wrap">
				<div class="field">
					<label for="r-monto-fijo">Monto fijo</label>
					<input
						id="r-monto-fijo"
						v-model="nuevo.montoFijoTexto"
						type="text"
						inputmode="decimal"
						class="input"
						placeholder="0,00"
					/>
				</div>
				<div class="field">
					<label for="r-cadencia"
						>Cadencia (cuándo se cobra/paga)</label
					>
					<select
						id="r-cadencia"
						v-model="nuevo.operacionPeriodo"
						class="input"
					>
						<option
							v-for="p in PERIODOS"
							:key="p.value"
							:value="p.value"
						>
							{{ p.label }}
						</option>
					</select>
				</div>
			</div>

			<label class="row usa-dinamico-toggle">
				<input v-model="nuevo.usaDinamico" type="checkbox" />
				Agregar una parte dinámica (comisión o interés porcentual)
			</label>

			<div v-if="nuevo.usaDinamico" class="stack dinamico-fields">
				<div class="row row-wrap">
					<div class="field">
						<label for="r-porcentaje">Porcentaje</label>
						<input
							id="r-porcentaje"
							v-model="nuevo.porcentajeTexto"
							type="text"
							inputmode="decimal"
							class="input"
							placeholder="Ej. 2 para 2%"
						/>
					</div>
					<div class="field">
						<label for="r-tasa-periodo">Período de la tasa</label>
						<select
							id="r-tasa-periodo"
							v-model="nuevo.tasaPeriodo"
							class="input"
						>
							<option
								v-for="p in PERIODOS"
								:key="p.value"
								:value="p.value"
							>
								{{ p.label }}
							</option>
						</select>
					</div>
					<div class="field">
						<label for="r-redondeo">Redondeo</label>
						<select
							id="r-redondeo"
							v-model="nuevo.redondeo"
							class="input"
						>
							<option
								v-for="r in REDONDEOS"
								:key="r.value"
								:value="r.value"
							>
								{{ r.label }}
							</option>
						</select>
					</div>
				</div>

				<div class="field">
					<label>Calcular el porcentaje sobre el saldo…</label>
					<div class="row row-wrap base-calculo-opciones">
						<label class="row"
							><input
								v-model="nuevo.baseCalculo"
								type="radio"
								value="inicio"
							/>
							Al inicio del período</label
						>
						<label class="row"
							><input
								v-model="nuevo.baseCalculo"
								type="radio"
								value="promedio"
							/>
							Promedio del período</label
						>
						<label class="row"
							><input
								v-model="nuevo.baseCalculo"
								type="radio"
								value="fin"
							/>
							Al final del período</label
						>
					</div>
				</div>
			</div>

			<div class="row row-wrap">
				<div class="field">
					<label for="r-fecha-inicio">Fecha de inicio</label>
					<input
						id="r-fecha-inicio"
						v-model="nuevo.fechaInicio"
						type="date"
						class="input"
					/>
				</div>
				<div class="field">
					<label for="r-fecha-fin">Fecha de fin (opcional)</label>
					<input
						id="r-fecha-fin"
						v-model="nuevo.fechaFin"
						type="date"
						class="input"
					/>
				</div>
			</div>

			<p v-if="errorCreando" class="alert alert-error">
				{{ errorCreando }}
			</p>

			<div class="form-actions">
				<button
					v-if="editandoId"
					type="button"
					class="btn btn-ghost"
					@click="cancelarEdicion"
				>
					Cancelar
				</button>

				<button
					type="submit"
					class="btn btn-primary"
					:disabled="creando"
				>
					{{
						editandoId
							? "Guardar cambios"
							: creando
								? "Guardando…"
								: "Crear regla"
					}}
				</button>
			</div>
		</form>

		<div class="table-wrap">
			<table class="data-table">
				<thead>
					<tr>
						<th>Concepto</th>
						<th>Cuenta</th>
						<th>Fijo</th>
						<th>Dinámico</th>
						<th>Cadencia</th>
						<th>Estado</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					<tr v-if="!reglas.length">
						<td colspan="7" class="text-muted">
							Todavía no hay reglas cargadas.
						</td>
					</tr>
					<tr v-for="r in reglas" :key="r.id">
						<td>{{ r.concepto }}</td>
						<td>{{ r.cuenta.nombre }}</td>
						<td>
							{{
								r.monto_fijo ? formatoMonto(r.monto_fijo) : "—"
							}}
						</td>
						<td>
							<span v-if="r.usa_dinamico">
								{{
									(r.porcentaje! * 100)
										.toString()
										.replace(".", ",")
								}}% {{ etiquetaPeriodo(r.tasa_periodo!) }} ({{
									r.base_calculo
								}})
							</span>
							<span v-else>—</span>
						</td>
						<td>{{ etiquetaPeriodo(r.operacion_periodo) }}</td>
						<td>
							<span
								class="badge"
								:class="
									r.activo ? 'badge-ingreso' : 'badge-egreso'
								"
							>
								{{ r.activo ? "activa" : "pausada" }}
							</span>
						</td>
						<td class="row acciones">
							<button
								type="button"
								class="btn btn-ghost"
								@click="alternarActivo(r.id, r.activo)"
							>
								{{ r.activo ? "Pausar" : "Reactivar" }}
							</button>

							<button
								v-if="mostrandoDetallesId === r.id"
								type="button"
								class="btn btn-ghost btn-primary"
								@click="cerrarDetalles()"
							>
								Cerrar
							</button>
							<button
								v-else
								type="button"
								class="btn btn-ghost btn-danger"
								@click="abrirDetalles(r)"
							>
								Detalles
							</button>
							<button
								v-if="editandoId === r.id"
								type="button"
								class="btn btn-ghost btn-primary"
								@click="cancelarEdicion()"
							>
								Cancelar
							</button>
							<button
								v-else
								type="button"
								class="btn btn-ghost btn-danger"
								@click="empezarEdicion(r)"
							>
								Editar
							</button>
							<button
								type="button"
								class="btn btn-ghost btn-danger"
								@click="borrar(r.id, r.concepto)"
							>
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
.recurrente-form {
	align-items: stretch;
}

.dinamico-fields {
	padding: 0.9rem;
	border: 1px dotted var(--color-border);
}

.usa-dinamico-toggle {
	align-items: center;
	gap: 0.5rem;
	font-weight: 600;
}

.base-calculo-opciones label {
	align-items: center;
	gap: 0.4rem;
	font-weight: 400;
}

.acciones {
	justify-content: flex-end;
}

.form-actions {
	display: flex;
}

.summary-actions-wrapper {
	justify-content: end;
	display: flex;
}

.summary-actions {
	display: flex;
	gap: 1rem;
	width: 80%;
}

.form-actions > *,
.summary-actions > * {
	width: 100%;
}

.summary {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
	background: var(--color-bg);
	border-radius: var(--radius-md);
	padding: 0.9rem 1rem;
    width: fit-content;
    margin: 0 auto;
}
</style>
