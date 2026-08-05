<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const { profile } = useProfile()
const { usuarios, fetchUsuarios, cambiarRol } = useUsuarios()

await fetchUsuarios()

const emailInvitar = ref('')
const invitando = ref(false)
const errorInvitar = ref<string | null>(null)
const okInvitar = ref(false)

async function invitarUsuario() {
  errorInvitar.value = null
  okInvitar.value = false

  const email = emailInvitar.value.trim()
  if (!email) {
    errorInvitar.value = 'Ingresa un correo electrónico'
    return
  }

  invitando.value = true
  try {
    await $fetch('/api/admin/invitar', { method: 'POST', body: { email } })
    okInvitar.value = true
    emailInvitar.value = ''
    await fetchUsuarios()
  } catch (err) {
    errorInvitar.value = extraerMensaje(err)
  } finally {
    invitando.value = false
  }
}

function extraerMensaje(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: { statusMessage?: string; message?: string } }).data
    if (data?.statusMessage) return data.statusMessage
    if (data?.message) return data.message
  }
  return err instanceof Error ? err.message : 'No se pudo enviar la invitación'
}

const cambiandoRolId = ref<string | null>(null)
const errorRol = ref<string | null>(null)

async function alternarRol(id: string, rolActual: 'member' | 'admin') {
  errorRol.value = null
  cambiandoRolId.value = id
  try {
    await cambiarRol(id, rolActual === 'admin' ? 'member' : 'admin')
  } catch (err) {
    errorRol.value = err instanceof Error ? err.message : 'No se pudo cambiar el rol'
  } finally {
    cambiandoRolId.value = null
  }
}
</script>

<template>
  <div class="stack">
    <h1>Usuarios</h1>
    <p class="text-muted">
      Invita a los miembros de la asociación por correo y elige quiénes tienen permisos de
      administrador. Los usuarios nuevos completan su nombre y contraseña la primera vez que
      inician sesión.
    </p>

    <form class="card row" @submit.prevent="invitarUsuario">
      <input
        v-model="emailInvitar"
        type="email"
        class="input"
        placeholder="correo@ejemplo.com"
        required
      >
      <button type="submit" class="btn btn-primary" :disabled="invitando">
        {{ invitando ? 'Invitando…' : 'Invitar' }}
      </button>
    </form>
    <p v-if="errorInvitar" class="alert alert-error">{{ errorInvitar }}</p>
    <p v-if="okInvitar" class="alert alert-ok">Invitación enviada.</p>
    <p v-if="errorRol" class="alert alert-error">{{ errorRol }}</p>

    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!usuarios.length">
            <td colspan="4" class="text-muted">Todavía no hay usuarios.</td>
          </tr>
          <tr v-for="u in usuarios" :key="u.id">
            <td>{{ u.full_name || '(sin completar)' }}</td>
            <td>{{ u.email }}</td>
            <td>
              <span class="badge badge-role">{{ u.role }}</span>
            </td>
            <td class="row acciones">
              <span v-if="u.id === profile?.id" class="text-muted tu-cuenta">Tú</span>
              <button
                v-else
                type="button"
                class="btn btn-ghost"
                :disabled="cambiandoRolId === u.id"
                @click="alternarRol(u.id, u.role)"
              >
                {{ u.role === 'admin' ? 'Quitar admin' : 'Hacer admin' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.acciones {
  justify-content: flex-end;
}

.tu-cuenta {
  font-size: 0.85rem;
}
</style>
