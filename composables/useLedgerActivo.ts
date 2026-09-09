const STORAGE_KEY = 'contabilify:ledger-activo'

// El "ledger activo" es la organización/instancia contable dentro de la que
// se está trabajando (una entre varias, si el usuario pertenece a más de
// una). Persiste entre sesiones igual que la cuenta activa, ver
// useCuentaActiva.ts.
export function useLedgerActivo() {
  const ledgerActivoId = useState<string | null>('ledger-activo', () => null)

  function seleccionar(id: string) {
    ledgerActivoId.value = id
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, id)
    }
  }

  function limpiar() {
    ledgerActivoId.value = null
    if (import.meta.client) {
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  function cargarDesdeStorage() {
    if (import.meta.client) {
      const guardado = localStorage.getItem(STORAGE_KEY)
      if (guardado) ledgerActivoId.value = guardado
    }
  }

  return { ledgerActivoId, seleccionar, limpiar, cargarDesdeStorage }
}
