import type { Database } from '~/types/database'
import type { Entidad } from '~/types/schema'

export function useEntidades() {
  const supabase = useSupabaseClient<Database>()
  const entidades = useState<Entidad[]>('entidades', () => [])
  const usoPorEntidad = useState<Record<string, number>>('entidades-uso', () => ({}))
  const pending = ref(false)
  const error = ref<string | null>(null)

  async function fetchEntidades() {
    pending.value = true
    error.value = null

    const [{ data: ents, error: errEnt }, { data: usos, error: errUso }] = await Promise.all([
      supabase.from('entidades').select('*').order('nombre', { ascending: true }),
      supabase.from('entidades_uso').select('*'),
    ])

    if (errEnt) error.value = errEnt.message
    entidades.value = (ents ?? []) as Entidad[]

    const uso: Record<string, number> = {}
    if (!errUso) {
      for (const fila of usos ?? []) {
        // count(*) llega como bigint; postgrest lo serializa como string.
        uso[fila.entidad_id as string] = Number(fila.usos)
      }
    }
    usoPorEntidad.value = uso
    pending.value = false
  }

  const entidadesActivas = computed(() => entidades.value.filter((e) => e.activa))

  function porFrecuencia(lista: Entidad[]) {
    return [...lista].sort(
      (a, b) => (usoPorEntidad.value[b.id] ?? 0) - (usoPorEntidad.value[a.id] ?? 0)
    )
  }

  // Ordenadas por frecuencia de uso (las más usadas primero) para la carga rápida.
  const entidadesPorFrecuencia = computed(() => porFrecuencia(entidadesActivas.value))

  // Todas (activas e inactivas), también por frecuencia, para el ABM de
  // entidades: ayuda a detectar cuáles conviene desactivar.
  const entidadesTodasPorFrecuencia = computed(() => porFrecuencia(entidades.value))

  async function crearEntidad(nombre: string) {
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) throw new Error('El nombre no puede estar vacío')

    const { data, error: err } = await supabase
      .from('entidades')
      .insert({ nombre: nombreLimpio })
      .select()
      .single()
    if (err) throw err
    await fetchEntidades()
    return data as Entidad
  }

  async function actualizarEntidad(id: string, changes: Partial<Entidad>) {
    const { error: err } = await supabase.from('entidades').update(changes).eq('id', id)
    if (err) throw err
    await fetchEntidades()
  }

  async function eliminarEntidad(id: string) {
    const { error: err } = await supabase.from('entidades').delete().eq('id', id)
    if (err) throw err
    await fetchEntidades()
  }

  return {
    entidades,
    entidadesActivas,
    entidadesPorFrecuencia,
    entidadesTodasPorFrecuencia,
    usoPorEntidad,
    pending,
    error,
    fetchEntidades,
    crearEntidad,
    actualizarEntidad,
    eliminarEntidad,
  }
}
