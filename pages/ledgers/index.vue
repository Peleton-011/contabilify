<script setup lang="ts">
import type { Ledger, LedgerConRol } from "~/types/schema";

const {
	ledgers,
	pending,
	error,
	fetchLedgers,
	crearLedger,
	actualizarLedger,
	eliminarLedger,
	seleccionar,
	ledgerActivoId,
} = useLedgers();
const { cuentas, fetchCuentas } = useCuentas();
const router = useRouter();

await fetchLedgers();

const nombreNuevo = ref("");
const creando = ref(false);
const errorCreando = ref<string | null>(null);

const editandoId = ref<string | null>(null);
const edicion = reactive({
	nombre: "",
});
const errorEdicion = ref<string | null>(null);
const guardandoEdicion = ref(false);

async function crear() {
	if (!nombreNuevo.value.trim()) return;
	creando.value = true;
	errorCreando.value = null;
	try {
		await crearLedger(nombreNuevo.value);
		nombreNuevo.value = "";
		router.push("/cuentas");
	} catch (err) {
		errorCreando.value =
			err instanceof Error ? err.message : "No se pudo crear el ledger";
	} finally {
		creando.value = false;
	}
}

function empezarEdicion(ledger: LedgerConRol) {
	editandoId.value = ledger.id;
	edicion.nombre = ledger.nombre;
}

function cancelarEdicion() {
	editandoId.value = null;
	errorEdicion.value = null;
}

async function guardarEdicion(id: string) {
	if (!edicion.nombre.trim()) {
		errorEdicion.value = "El nombre no puede estar vacío";
	}

	guardandoEdicion.value = true;
	errorEdicion.value = null;

	try {
		await actualizarLedger(id, {
			nombre: edicion.nombre,
		});
		editandoId.value = null;
	} catch (err) {
		errorEdicion.value =
			err instanceof Error ? err.message : "no se pudo guardar";
	} finally {
		guardandoEdicion.value = false;
	}
}

async function borrar(l: LedgerConRol) {
	if (
		!confirm(
			`¿Eliminar el ledger "${l.nombre}", además de todas las cuentas y movimientos en su interior? \n Esta acción no es reversible`,
		)
	)
		return;
	if (
		!confirm(
			"¿Seguro? Toda la información no respaldada fuera de Contabilify se perderá para siempre...",
		)
	)
		return;
	await eliminarLedger(l.id);
}

function elegir(id: string) {
	if (id === editandoId.value) {
		return;
	}
	seleccionar(id);
	fetchCuentas(true).then(() => {
		if (cuentas.value.length) {
			router.push("/");
		} else {
			router.push("/cuentas");
		}
	});
}
</script>

<template>
	<div class="stack ledgers-stack">
		<h1>Tus ledgers</h1>
		<p class="text-muted">
			Cada ledger es una organización contable independiente, con sus
			propias cuentas, entidades y movimientos. Elige uno para entrar o
			crea uno nuevo.
		</p>

		<p v-if="error" class="alert alert-error">{{ error }}</p>

		<p v-if="pending && !ledgers.length" class="card text-muted">
			Cargando…
		</p>

		<div v-else-if="ledgers.length" class="grid-balances">
			<article
				v-for="l in ledgers"
				:key="l.id"
				type="button"
				class="card ledger-card"
				:class="{ seleccionada: l.id === ledgerActivoId }"
				@click="elegir(l.id)"
			>
				<div v-if="editandoId === l.id">
					<form
						class="ledger-form"
						@submit.prevent="guardarEdicion(l.id)"
					>
						<input
							id="l-nombre"
							v-model="edicion.nombre"
							type="text"
							class="input"
							:placeholder="l.nombre"
						/>
						<p v-if="errorEdicion" class="alert alert-error">
							{{ errorEdicion }}
						</p>
						<div class="self-end">
							<button
								type="submit"
								class="btn btn-primary"
								:disabled="guardandoEdicion"
                                @click.stop
							>
								Guardar
							</button>
							<button
								type="button"
								class="btn btn-ghost"
								@click.stop="cancelarEdicion"
							>
								Cancelar
							</button>
						</div>
					</form>
				</div>

				<div v-else>
					<div class="ledger-header">
						<span class="ledger-nombre">{{ l.nombre }}</span>
						<span
							class="badge ml-auto mr-10"
							:class="
								l.role === 'admin'
									? 'badge-ingreso'
									: 'badge-egreso'
							"
						>
							{{ l.role === "admin" ? "admin" : "miembro" }}
						</span>
					</div>
					<div class="ledger-actions" v-if="l.role === 'admin'">
						<button
							type="button"
							class="btn btn-ghost"
							@click.stop="empezarEdicion(l)"
						>
							Editar
						</button>
						<button
							type="button"
							class="btn btn-ghost btn-danger"
							@click.stop="borrar(l)"
						>
							Eliminar
						</button>
					</div>
				</div>
			</article>
		</div>

		<p v-else class="card text-muted">
			Todavía no perteneces a ningún ledger.
		</p>

		<form class="card ledger-form" @submit.prevent="crear">
			<div class="field">
				<label for="l-nombre">Crear un ledger nuevo</label>
				<input
					id="l-nombre"
					v-model="nombreNuevo"
					type="text"
					class="input"
					placeholder="Ej. Mi negocio"
				/>
			</div>
			<p v-if="errorCreando" class="alert alert-error">
				{{ errorCreando }}
			</p>
			<button type="submit" class="btn btn-primary" :disabled="creando">
				Crear ledger
			</button>
		</form>
	</div>
</template>

<style scoped>
.ledgers-stack {
	max-width: 640px;
}

.ledger-card {
	width: 100%;
	text-align: left;
	font: inherit;
	cursor: pointer;
	transition:
		border-color 0.15s ease,
		background 0.15s ease;
}

.ledger-card > * {
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	justify-content: space-between;
	gap: 1rem;
}

.ledger-actions {
	align-self: flex-end;
}

.ledger-card:hover {
	border-color: var(--color-primary);
}

.ledger-card.seleccionada {
	border-color: var(--color-primary);
	border-width: 2px;
	background: color-mix(
		in oklch,
		var(--color-primary) 8%,
		var(--color-surface)
	);
}

.ledger-header {
	display: flex;
	width: 100%;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 0.5rem;
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
	justify-content: space-between;
    width: 100%;
}
</style>
