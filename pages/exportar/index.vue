<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const anioActual = new Date().getFullYear()

const modo = ref<'anio' | 'rango'>('anio')
const anio = ref(anioActual)
const desde = ref('')
const hasta = ref('')

const aniosDisponibles = computed(() => {
  const lista: number[] = []
  for (let a = anioActual + 1; a >= anioActual - 10; a--) lista.push(a)
  return lista
})

const urlExportar = computed(() => {
  const d = modo.value === 'anio' ? `${anio.value}-01-01` : desde.value
  const h = modo.value === 'anio' ? `${anio.value}-12-31` : hasta.value
  if (!d || !h) return null
  return `/api/exportar?desde=${d}&hasta=${h}`
})

const archivo = ref<File | null>(null)
const sincronizando = ref(false)
const errorSync = ref<string | null>(null)
const resumenSync = ref<string | null>(null)

function onArchivoElegido(e: Event) {
  const input = e.target as HTMLInputElement
  archivo.value = input.files?.[0] ?? null
  errorSync.value = null
  resumenSync.value = null
}

async function extraerMensaje(err: unknown): Promise<string> {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: unknown }).data
    if (data instanceof Blob) {
      try {
        const json = JSON.parse(await data.text())
        if (json.statusMessage) return json.statusMessage
        if (json.message) return json.message
      } catch {
        // no era JSON: seguimos con el mensaje genérico
      }
    } else if (data && typeof data === 'object') {
      const obj = data as { statusMessage?: string; message?: string }
      if (obj.statusMessage) return obj.statusMessage
      if (obj.message) return obj.message
    }
  }
  return err instanceof Error ? err.message : 'No se pudo sincronizar el archivo'
}

async function sincronizar() {
  if (!archivo.value) return
  sincronizando.value = true
  errorSync.value = null
  resumenSync.value = null
  try {
    const formData = new FormData()
    formData.append('archivo', archivo.value)
    const respuesta = await $fetch.raw('/api/sincronizar', {
      method: 'POST',
      body: formData,
      responseType: 'blob',
    })

    const agregados = respuesta.headers.get('x-movimientos-agregados')
    const blob = respuesta._data as unknown as Blob
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cuentas-actualizado.xlsx'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)

    const cantidad = Number(agregados ?? 0)
    resumenSync.value = cantidad
      ? `Se agregaron ${cantidad} movimiento(s) que faltaban. Descargando la copia actualizada…`
      : 'El archivo ya estaba al día: no se agregó ningún movimiento.'
  } catch (err) {
    errorSync.value = await extraerMensaje(err)
  } finally {
    sincronizando.value = false
  }
}
</script>

<template>
  <div class="stack">
    <h1>Exportar / sincronizar</h1>

    <section class="card stack">
      <h2>Exportar movimientos</h2>
      <p class="text-muted">
        Descarga un rango de fechas como una hoja con el mismo formato de "año contable" que la
        planilla histórica (Egresos/Ingresos/Saldo por cuenta, más el Conjunto).
      </p>

      <div class="row row-wrap">
        <label class="row">
          <input v-model="modo" type="radio" value="anio">
          Año completo
        </label>
        <label class="row">
          <input v-model="modo" type="radio" value="rango">
          Rango personalizado
        </label>
      </div>

      <div v-if="modo === 'anio'" class="field">
        <label for="anio">Año</label>
        <select id="anio" v-model.number="anio" class="input">
          <option v-for="a in aniosDisponibles" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>
      <div v-else class="row row-wrap">
        <div class="field">
          <label for="desde">Desde</label>
          <input id="desde" v-model="desde" type="date" class="input">
        </div>
        <div class="field">
          <label for="hasta">Hasta</label>
          <input id="hasta" v-model="hasta" type="date" class="input">
        </div>
      </div>

      <a v-if="urlExportar" :href="urlExportar" class="btn btn-primary" download>Descargar Excel</a>
      <p v-else class="text-muted">Completa el rango de fechas para descargar.</p>
    </section>

    <section class="card stack">
      <h2>Actualizar mi archivo Excel</h2>
      <p class="text-muted">
        Sube tu copia de la planilla. No se modifica nada en Contabilify: la app busca movimientos
        que ya están cargados acá pero no aparecen en tu archivo, y te devuelve una copia
        actualizada con esas filas agregadas en la pestaña del año que corresponda (creando una
        pestaña nueva si hace falta). Las pestañas de años ya al día quedan intactas; las que
        reciben movimientos nuevos se regeneran con fórmulas limpias.
      </p>

      <div class="field">
        <label for="archivo">Archivo Excel (.xlsx)</label>
        <input id="archivo" type="file" accept=".xlsx" class="input" @change="onArchivoElegido">
      </div>

      <button
        type="button"
        class="btn btn-primary"
        :disabled="!archivo || sincronizando"
        @click="sincronizar"
      >
        {{ sincronizando ? 'Sincronizando…' : 'Sincronizar y descargar' }}
      </button>

      <p v-if="errorSync" class="alert alert-error">{{ errorSync }}</p>
      <p v-if="resumenSync" class="alert alert-ok">{{ resumenSync }}</p>
    </section>
  </div>
</template>
