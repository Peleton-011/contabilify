import type { Database } from "~/types/database";
import type { Ledger, LedgerConRol, Rol } from "~/types/schema";

export function useLedgers() {
	const supabase = useSupabaseClient<Database>();
	const ledgers = useState<LedgerConRol[]>("ledgers", () => []);
	const pending = ref(false);
	const error = ref<string | null>(null);
	const user = useSupabaseUser();
	const { ledgerActivoId, seleccionar, cargarDesdeStorage } =
		useLedgerActivo();

	async function fetchLedgers() {
		pending.value = true;
		error.value = null;

		if (!user.value) {
			user.value = null;
			return;
		}

		const { data, error: err } = await supabase
			.from("ledger_members")
			.select("role, ledgers(id, nombre, created_by, created_at)")
			.eq("user_id", user.value.id)
			.order("nombre", { referencedTable: "ledgers", ascending: true });

		if (err) {
			error.value = err.message;
		} else {
			const filas = (data ?? []) as unknown as Array<{
				role: Rol;
				ledgers: Ledger | null;
			}>;
			ledgers.value = filas
				.filter(
					(fila): fila is { role: Rol; ledgers: Ledger } =>
						!!fila.ledgers,
				)
				.map((fila) => ({ ...fila.ledgers, role: fila.role }));
		}
		pending.value = false;
	}

	async function crearLedger(nombre: string) {
		const { data, error: err } = await supabase.rpc("crear_ledger", {
			p_nombre: nombre,
		});
		if (err) throw err;
		await fetchLedgers();
		if (data) seleccionar(data.id);
		return data;
	}

	// Si el ledger guardado en localStorage ya no es válido (o no hay
	// ninguno elegido todavía), cae al primero de la lista.
	function asegurarLedgerActivo() {
		cargarDesdeStorage();
		if (
			ledgerActivoId.value &&
			ledgers.value.some((l) => l.id === ledgerActivoId.value)
		)
			return;
		if (ledgers.value.length) seleccionar(ledgers.value[0].id);
	}

	const ledgerActivo = computed(
		() => ledgers.value.find((l) => l.id === ledgerActivoId.value) ?? null,
	);
	const isAdminActivo = computed(() => ledgerActivo.value?.role === "admin");

	return {
		ledgers,
		pending,
		error,
		fetchLedgers,
		crearLedger,
		asegurarLedgerActivo,
		ledgerActivoId,
		ledgerActivo,
		isAdminActivo,
		seleccionar,
	};
}
