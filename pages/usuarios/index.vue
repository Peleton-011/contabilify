<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const { profile } = useProfile()
const { usuarios, fetchUsuarios, cambiarRol } = useUsuarios()

await fetchUsuarios()

const emailInvitar = ref('')
const invitando = ref(false)
const errorInvitar = ref<string | null>(null)
const okInvitar = ref(false)
const enlaceInvitacion = ref<string | null>(null)

async function invitarUsuario() {
  errorInvitar.value = null
  okInvitar.value = false
  enlaceInvitacion.value = null

  const email = emailInvitar.value.trim()
  if (!email) {
    errorInvitar.value = 'Ingresa un correo electrónico'
    return
  }

  invitando.value = true
  try {
    const respuesta = await $fetch('/api/admin/invitar', { method: 'POST', body: { email } })
    if (respuesta.correoEnviado) {
      okInvitar.value = true
    } else {
      enlaceInvitacion.value = respuesta.enlace
    }
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

const usuarioAEliminar = ref<{ id: string; nombre: string } | null>(null)
const eliminando = ref(false)
const errorEliminar = ref<string | null>(null)

function pedirEliminar(u: { id: string; full_name: string | null; email: string | null }) {
  errorEliminar.value = null
  usuarioAEliminar.value = { id: u.id, nombre: u.full_name || u.email || 'este usuario' }
}

async function confirmarEliminar() {
  if (!usuarioAEliminar.value) return
  eliminando.value = true
  errorEliminar.value = null
  try {
    await $fetch('/api/admin/eliminar-usuario', {
      method: 'POST',
      body: { id: usuarioAEliminar.value.id },
    })
    usuarioAEliminar.value = null
    await fetchUsuarios()
  } catch (err) {
    errorEliminar.value = extraerMensaje(err)
  } finally {
    eliminando.value = false
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
    <div v-if="enlaceInvitacion" class="alert alert-error stack enlace-manual">
      <p>
        No se pudo enviar el correo automáticamente (¿configuraste el SMTP? ver README).
        Copiá este enlace y mandáselo vos:
      </p>
      <input :value="enlaceInvitacion" type="text" class="input" readonly @focus="($event.target as HTMLInputElement).select()">
    </div>
    <p v-if="errorRol" class="alert alert-error">{{ errorRol }}</p>
    <p v-if="errorEliminar" class="alert alert-error">{{ errorEliminar }}</p>

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
              <template v-else>
                <button
                  type="button"
                  class="btn btn-ghost"
                  :disabled="cambiandoRolId === u.id"
                  @click="alternarRol(u.id, u.role)"
                >
                  {{ u.role === 'admin' ? 'Quitar admin' : 'Hacer admin' }}
                </button>
                <button type="button" class="btn btn-ghost btn-danger" @click="pedirEliminar(u)">
                  Eliminar
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmModal
      :abierto="!!usuarioAEliminar"
      titulo="Eliminar usuario"
      :mensaje="`¿Eliminar a ${usuarioAEliminar?.nombre}? Pierde el acceso a la app de inmediato. Sus movimientos ya cargados no se borran.`"
      texto-confirmar="Eliminar"
      peligroso
      :procesando="eliminando"
      @confirmar="confirmarEliminar"
      @cancelar="usuarioAEliminar = null"
    />
  </div>
</template>

<style scoped>
.acciones {
  justify-content: flex-end;
}

.tu-cuenta {
  font-size: 0.85rem;
}

.enlace-manual {
  gap: 0.5rem;
}

.enlace-manual p {
  margin: 0;
}

.enlace-manual .input {
  font-size: 0.8rem;
  background: var(--color-surface);
}
</style>
