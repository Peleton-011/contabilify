const STORAGE_KEY = 'contabilify:ultima-fecha'

// Recuerda la última fecha usada en la carga rápida para que la próxima
// carga arranque directamente en ese día (y no siempre en "hoy").
export function useUltimaFecha() {
  const ultimaFecha = useState<string>('ultima-fecha', () => hoyISO())

  function actualizar(fechaISO: string) {
    ultimaFecha.value = fechaISO
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, fechaISO)
    }
  }

  function cargarDesdeStorage() {
    if (import.meta.client) {
      const guardada = localStorage.getItem(STORAGE_KEY)
      if (guardada && normalizarFecha(guardada)) {
        ultimaFecha.value = guardada
      }
    }
  }

  return { ultimaFecha, actualizar, cargarDesdeStorage }
}
