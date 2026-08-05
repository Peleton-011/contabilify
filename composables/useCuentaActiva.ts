const STORAGE_KEY = 'contabilify:cuenta-activa'

// La "cuenta activa" es la cuenta sobre la que se registran los movimientos
// en la carga rápida. Se elige haciendo clic en su tarjeta de saldo en el
// panel principal y funciona como un ajuste general (no como un paso más
// del formulario), ya que en el uso normal se cargan varios movimientos
// seguidos contra una misma cuenta.
export function useCuentaActiva() {
  const cuentaActivaId = useState<string | null>('cuenta-activa', () => null)

  function seleccionar(id: string) {
    cuentaActivaId.value = id
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, id)
    }
  }

  function cargarDesdeStorage() {
    if (import.meta.client) {
      const guardada = localStorage.getItem(STORAGE_KEY)
      if (guardada) cuentaActivaId.value = guardada
    }
  }

  return { cuentaActivaId, seleccionar, cargarDesdeStorage }
}
