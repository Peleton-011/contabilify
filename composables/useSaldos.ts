import type { Database } from "~/types/database";
import type { SaldoCuenta } from "~/types/schema";

const SELECT_CON_RELACIONES =
	"*, entidad:entidades(id, nombre), cuenta:cuentas(id, nombre, tipo)";

export function useSaldos() {
	const supabase = useSupabaseClient<Database>();
	const saldos = useState<SaldoCuenta[]>("saldos", () => []);
    const balanceInicial = useState<number[]>("balanceInicial", () => []);
	const pending = ref(false);
	const error = ref<string | null>(null);
	const { ledgerActivoId } = useLedgerActivo();
	const { cuentas, fetchCuentas } = useCuentas();
	const {
		movimientos,
		fetchMovimientos,
		actualizarMovimiento,
		eliminarMovimiento,
		pending: pendingMovimientos,
	} = useMovimientos();

	async function fetchSaldos({
		desde,
		hasta,
	}: { desde?: string; hasta?: string } = {}) {
		if (!ledgerActivoId.value) {
			saldos.value = [];
			return;
		}
		pending.value = true;
		error.value = null;
		const { data, error: err } = await supabase
			.from("saldos_cuentas")
			.select("*")
			.eq("ledger_id", ledgerActivoId.value)
			.order("orden", { ascending: true });
		if (err) error.value = err.message;
		else saldos.value = (data ?? []) as SaldoCuenta[];
		pending.value = false;
	}

	async function fetchSaldoEn(fecha: string) {
		if (!ledgerActivoId.value) {
			saldos.value = [];
			return;
		}
		pending.value = true;
		error.value = null;

		let query = supabase
			.from("movimientos")
			.select(SELECT_CON_RELACIONES)
			.eq("ledger_id", ledgerActivoId.value)
			.order("fecha", { ascending: false })
			.filter("fecha", "<=", fecha);

		const { data, error: err } = await query;
		if (err) error.value = err.message;
		else {
			const movimientos = (data ?? []) as unknown as SaldoCuenta[];

			pending.value = false;

			return movimientos.reduce((acc, s) => acc + s.saldo_actual, 0);
		}
	}

	async function fetchBalanceInicial(filtros: FiltrosMovimientos) {
		if (!filtros.desde || filtros.desde === undefined) {
			balanceInicial.value = cuentas.value.map((c) => c.saldo_inicial);
		} else {
            await fetchMovimientos({...filtros, desde: undefined});
            await fetchCuentas();
			return cuentas.value.map((c, i) => {
				const movimientosCuenta = movimientos.value.filter(
					(m) =>
						m.cuenta_id === c.id &&
						filtros.desde &&
						m.fecha < filtros.desde,
				);
				const saldoInicial = c.saldo_inicial;
				const saldoMovimientos = movimientosCuenta.reduce((acc, m) => {
					if (m.tipo === "ingreso") return acc + m.monto;
					else if (m.tipo === "egreso") return acc - m.monto;
					else return acc;
				}, 0);
				balanceInicial.value[i] = saldoInicial + saldoMovimientos;
			});
		}
	}

	const saldoTotal = computed(() =>
		saldos.value.reduce((acc, s) => acc + s.saldo_actual, 0),
	);

	return { balanceInicial, saldos, saldoTotal, pending, error, fetchSaldos, fetchBalanceInicial, fetchSaldoEn };
}
