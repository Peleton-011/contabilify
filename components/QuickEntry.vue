<script setup lang="ts">
import type { Cuenta, Entidad, TipoMovimiento } from "~/types/schema";
// Import explícito: en algunos entornos de desarrollo el auto-import de
// Nuxt no recoge funciones nuevas de utils/ sin reiniciar el dev server.
import { formatoMonto, parseMonto } from "~/utils/moneda";

const emit = defineEmits<{
	guardado: [];
}>();

type Paso = "tipo" | "monto" | "entidad" | "concepto" | "fecha";
const PASOS: Paso[] = ["tipo", "monto", "entidad", "concepto", "fecha"];

const { cuentas, fetchCuentas } = useCuentas();
const { entidadesPorFrecuencia, fetchEntidades } = useEntidades();
const { crearMovimiento, crearTransferencia } = useMovimientos();
const {
	ultimaFecha,
	actualizar: actualizarUltimaFecha,
	cargarDesdeStorage,
} = useUltimaFecha();
const { cuentaActivaId } = useCuentaActiva();
const user = useSupabaseUser();

await Promise.all([fetchCuentas(), fetchEntidades()]);
cargarDesdeStorage();

const pasoActual = ref<Paso>("tipo");
const indicePaso = computed(() => PASOS.indexOf(pasoActual.value));

const tipo = ref<TipoMovimiento | null>(null);
const montoTexto = ref("");
const entidadId = ref<string | null>(null);
const entidadNombre = ref("");
const cuentaContraparteId = ref<string | null>(null);
const concepto = ref("");
const conceptoTocado = ref(false);
const fecha = ref(ultimaFecha.value);

const guardando = ref(false);
const error = ref<string | null>(null);
const guardadoOk = ref(false);

const montoInputRef = ref<HTMLInputElement | null>(null);
const conceptoInputRef = ref<HTMLInputElement | null>(null);
const entitySelectRef = ref<{ focus: () => void } | null>(null);

const montoNumero = computed(() => {
	const valor = parseMonto(montoTexto.value);
	return Number.isFinite(valor) ? valor : NaN;
});

const montoValido = computed(() => montoNumero.value > 0);

const cuentaActivaNombre = computed(
	() =>
		cuentas.value.find((c) => c.id === cuentaActivaId.value)?.nombre ?? "—",
);

// Otras cuentas disponibles para registrar una transferencia entre cuentas
// propias, en lugar de una entidad externa.
const otrasCuentas = computed(() =>
	cuentas.value.filter((c) => c.id !== cuentaActivaId.value),
);

function irA(paso: Paso) {
	error.value = null;
	pasoActual.value = paso;
	nextTick(() => {
		if (paso === "monto") montoInputRef.value?.focus();
		if (paso === "entidad") entitySelectRef.value?.focus();
		if (paso === "concepto") conceptoInputRef.value?.focus();
	});
}

function elegirTipo(valor: TipoMovimiento) {
	tipo.value = valor;
	irA("monto");
}

function confirmarMonto() {
	if (!montoValido.value) {
		error.value = "Ingresa un monto mayor a cero";
		return;
	}
	irA("entidad");
}

function alSeleccionarEntidad(entidad: Entidad | null) {
	cuentaContraparteId.value = null;
	entidadNombre.value = entidad?.nombre ?? "";
	if (!conceptoTocado.value) concepto.value = entidad?.nombre ?? "";
}

function elegirTransferencia(otra: Cuenta) {
	cuentaContraparteId.value = otra.id;
	entidadId.value = null;
	entidadNombre.value = "";
	if (!conceptoTocado.value) {
		concepto.value =
			tipo.value === "egreso"
				? `Transferencia a ${otra.nombre}`
				: `Transferencia desde ${otra.nombre}`;
	}
}

function continuarDesdeEntidad() {
	irA("concepto");
}

function confirmarConcepto() {
	if (!concepto.value.trim()) {
		error.value = "Ingresa un concepto para el movimiento";
		return;
	}
	irA("fecha");
}

const resumen = computed(() => {
	const base = {
		tipoLabel: tipo.value === "ingreso" ? "Ingreso" : "Egreso",
		monto: Number.isFinite(montoNumero.value)
			? formatoMonto(montoNumero.value)
			: "—",
		concepto: concepto.value || "—",
	};

	if (cuentaContraparteId.value) {
		const contraparte = cuentas.value.find(
			(c) => c.id === cuentaContraparteId.value,
		);
		const origen =
			tipo.value === "egreso"
				? cuentaActivaNombre.value
				: (contraparte?.nombre ?? "—");
		const destino =
			tipo.value === "egreso"
				? (contraparte?.nombre ?? "—")
				: cuentaActivaNombre.value;
		return { ...base, esTransferencia: true as const, origen, destino };
	}

	return {
		...base,
		esTransferencia: false as const,
		entidad: entidadNombre.value || "Sin entidad",
		cuenta: cuentaActivaNombre.value,
	};
});

async function guardar() {
	if (
		!tipo.value ||
		!cuentaActivaId.value ||
		!montoValido.value ||
		!concepto.value.trim()
	) {
		error.value = "Faltan datos por completar";
		return;
	}
	const fechaNormalizada = normalizarFecha(fecha.value);
	if (!fechaNormalizada) {
		error.value = "La fecha no es válida";
		return;
	}

	guardando.value = true;
	error.value = null;
	try {
		if (cuentaContraparteId.value) {
			const cuentaOrigenId =
				tipo.value === "egreso"
					? cuentaActivaId.value
					: cuentaContraparteId.value;
			const cuentaDestinoId =
				tipo.value === "egreso"
					? cuentaContraparteId.value
					: cuentaActivaId.value;
			await crearTransferencia({
				fecha: fechaNormalizada,
				monto: montoNumero.value,
				concepto: concepto.value.trim(),
				cuentaOrigenId,
				cuentaDestinoId,
				createdBy: user.value?.id ?? null,
			});
		} else {
			await crearMovimiento({
				fecha: fechaNormalizada,
				tipo: tipo.value,
				monto: montoNumero.value,
				concepto: concepto.value.trim(),
				entidad_id: entidadId.value,
				cuenta_id: cuentaActivaId.value,
				notas: null,
				numero_factura: null,
				metadata: {},
				created_by: user.value?.id ?? null,
			});
		}

		actualizarUltimaFecha(fechaNormalizada);
		guardadoOk.value = true;
		emit("guardado");
		reiniciar();
		// Refresca los conteos de uso para que el próximo movimiento de esta
		// misma sesión ya vea reflejada la frecuencia recién actualizada.
		fetchEntidades();
	} catch (err) {
		error.value =
			err instanceof Error
				? err.message
				: "No se pudo guardar el movimiento";
	} finally {
		guardando.value = false;
	}
}

function reiniciar() {
	tipo.value = null;
	montoTexto.value = "";
	entidadId.value = null;
	entidadNombre.value = "";
	cuentaContraparteId.value = null;
	concepto.value = "";
	conceptoTocado.value = false;
	fecha.value = ultimaFecha.value;
	pasoActual.value = "tipo";
}

watch(concepto, () => {
	conceptoTocado.value = true;
});

function alPresionarEnterMonto(evento: KeyboardEvent) {
	evento.preventDefault();
	confirmarMonto();
}

function alPresionarEnterConcepto(evento: KeyboardEvent) {
	evento.preventDefault();
	confirmarConcepto();
}
</script>

<template>
	<section class="card">
		<div v-if="!cuentaActivaId" class="quick-entry">
			<p class="text-muted">
				Selecciona una cuenta arriba para empezar a cargar movimientos.
			</p>
		</div>

		<div v-else class="quick-entry">
			<div class="qe-header">
				<div class="qe-progress">
					<span
						v-for="(paso, i) in PASOS"
						:key="paso"
						class="qe-dot"
						:class="{ activo: i <= indicePaso }"
					/>
				</div>
				<button
					v-if="pasoActual !== 'tipo'"
					type="button"
					class="btn btn-ghost qe-back"
					@click="irA(PASOS[Math.max(0, indicePaso - 1)])"
				>
					← Atrás
				</button>
			</div>

			<transition name="fade" mode="out-in">
				<!-- Paso 1: tipo -->
				<div v-if="pasoActual === 'tipo'" key="tipo" class="qe-step">
					<h2>¿Ingreso o egreso?</h2>
					<p class="text-muted qe-cuenta-activa">
						Cuenta activa: <strong>{{ cuentaActivaNombre }}</strong>
					</p>
					<div class="qe-choice-grid">
						<button
							type="button"
							class="btn btn-lg choice-ingreso"
							@click="elegirTipo('ingreso')"
						>
							Ingreso
						</button>
						<button
							type="button"
							class="btn btn-lg choice-egreso"
							@click="elegirTipo('egreso')"
						>
							Egreso
						</button>
					</div>
				</div>

				<!-- Paso 2: monto -->
				<div
					v-else-if="pasoActual === 'monto'"
					key="monto"
					class="qe-step"
				>
					<h2>Monto del {{ tipo }}</h2>
					<input
						ref="montoInputRef"
						v-model="montoTexto"
						type="text"
						inputmode="decimal"
						placeholder="0,00"
						class="input qe-monto-input"
						@keydown.enter="alPresionarEnterMonto"
					/>
					<button
						type="button"
						class="btn btn-primary btn-block btn-lg"
						@click="confirmarMonto"
					>
						Continuar
					</button>
				</div>

				<!-- Paso 3: entidad -->
				<div
					v-else-if="pasoActual === 'entidad'"
					key="entidad"
					class="qe-step"
				>
					<h2>¿Con quién es la operación?</h2>
					<EntitySelect
						ref="entitySelectRef"
						v-model="entidadId"
						:entidades="entidadesPorFrecuencia"
						@seleccionada="alSeleccionarEntidad"
					/>

					<div v-if="otrasCuentas.length" class="qe-transfer-block">
						<p class="text-muted qe-transfer-label">
							O registra un movimiento entre cuentas:
						</p>
						<div class="qe-transfer-chips">
							<button
								v-for="otra in otrasCuentas"
								:key="otra.id"
								type="button"
								class="btn qe-transfer-chip"
								:class="{
									activo: cuentaContraparteId === otra.id,
								}"
								@click="elegirTransferencia(otra)"
							>
								↔
								{{
									tipo === "egreso"
										? `Transferir a ${otra.nombre}`
										: `Transferir desde ${otra.nombre}`
								}}
							</button>
						</div>
					</div>

					<button
						type="button"
						class="btn btn-primary btn-block btn-lg"
						@click="continuarDesdeEntidad"
					>
						Continuar
					</button>
				</div>

				<!-- Paso 4: concepto -->
				<div
					v-else-if="pasoActual === 'concepto'"
					key="concepto"
					class="qe-step"
				>
					<h2>Concepto</h2>
					<input
						ref="conceptoInputRef"
						v-model="concepto"
						type="text"
						placeholder="Descripción breve del movimiento"
						class="input"
						@keydown.enter="alPresionarEnterConcepto"
					/>
					<button
						type="button"
						class="btn btn-primary btn-block btn-lg"
						@click="confirmarConcepto"
					>
						Continuar
					</button>
				</div>

				<!-- Paso 5: fecha + confirmación -->
				<div v-else key="fecha" class="qe-step">
					<h2>Fecha</h2>
					<DateStepper v-model="fecha" />

					<div class="qe-summary">
						<div class="row">
							<span class="text-muted">Monto</span
							><span class="spacer" /><strong>{{
								resumen.monto
							}}</strong>
						</div>
						<div class="row">
							<span class="text-muted">Concepto</span
							><span class="spacer" /><span>{{
								resumen.concepto
							}}</span>
						</div>

						<template v-if="resumen.esTransferencia">
							<div class="row">
								<span class="text-muted">De</span
								><span class="spacer" /><span>{{
									resumen.origen
								}}</span>
							</div>
							<div class="row">
								<span class="text-muted">A</span
								><span class="spacer" /><span>{{
									resumen.destino
								}}</span>
							</div>
						</template>
						<template v-else>
							<div class="row">
								<span class="text-muted">Tipo</span
								><span class="spacer" /><span
									:class="
										tipo === 'ingreso'
											? 'text-ingreso'
											: 'text-egreso'
									"
									>{{ resumen.tipoLabel }}</span
								>
							</div>
							<div class="row">
								<span class="text-muted">Entidad</span
								><span class="spacer" /><span>{{
									resumen.entidad
								}}</span>
							</div>
							<div class="row">
								<span class="text-muted">Cuenta</span
								><span class="spacer" /><span>{{
									resumen.cuenta
								}}</span>
							</div>
						</template>
					</div>

					<button
						type="button"
						class="btn btn-primary btn-block btn-lg"
						:disabled="guardando"
						@click="guardar"
					>
						{{ guardando ? "Guardando…" : "Guardar movimiento" }}
					</button>
				</div>
			</transition>

			<p v-if="error" class="alert alert-error">{{ error }}</p>
			<p v-if="guardadoOk && !error" class="alert alert-ok">
				Movimiento guardado. ¡Listo para el siguiente!
			</p>
		</div>
	</section>
</template>

<style scoped>
.quick-entry {
	max-width: 420px;
	margin: 0 auto;
}

.qe-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 1.25rem;
}

.qe-progress {
	display: flex;
	gap: 0.35rem;
}

.qe-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--color-border);
}

.qe-dot.activo {
	background: var(--color-primary);
}

.qe-back {
	font-size: 0.85rem;
	padding: 0.3em 0.6em;
}

.qe-step h2 {
	font-size: 1.15rem;
	margin-bottom: 1rem;
	text-align: center;
	text-transform: capitalize;
}

.qe-step {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.qe-cuenta-activa {
	margin-top: -0.5rem;
	text-align: center;
	font-size: 0.85rem;
}

.qe-choice-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 0.85rem;
}

.choice-ingreso {
	background: var(--color-ingreso-bg);
	color: var(--color-ingreso);
	border-color: var(--color-ingreso);
}

.choice-egreso {
	background: var(--color-egreso-bg);
	color: var(--color-egreso);
	border-color: var(--color-egreso);
}

.qe-monto-input {
	text-align: center;
	font-family: var(--font-body);
	font-size: 1.6rem;
	font-weight: 700;
	padding: 0.5em;
}

.qe-transfer-block {
	border-top: 1px dashed var(--color-border);
	padding-top: 0.85rem;
}

.qe-transfer-label {
	font-size: 0.82rem;
	margin-bottom: 0.5rem;
}

.qe-transfer-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.qe-transfer-chip {
	font-size: 0.85rem;
	padding: 0.5em 0.9em;
}

.qe-transfer-chip.activo {
	background: var(--color-primary);
	color: var(--color-primary-contrast);
	border-color: var(--color-primary);
}

.qe-summary {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	background: var(--color-bg);
	border-radius: var(--radius-md);
	padding: 0.9rem 1rem;
}

.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.12s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
