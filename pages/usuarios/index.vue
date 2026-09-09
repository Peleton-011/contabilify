<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

const { profile } = useProfile()
const { ledgerActivoId } = useLedgers()
const { usuarios, fetchUsuarios, cambiarRol } = useUsuarios()

await fetchUsuarios()

const emailInvitar = ref('')
const invitando = ref(false)
const errorInvitar = ref<string | null>(null)
const okInvitar = ref(false)
const ultimoRedirectTo = ref<string | null>(null)

async function invitarUsuario() {
  errorInvitar.value = null
  okInvitar.value = false
  ultimoRedirectTo.value = null

  const email = emailInvitar.value.trim()
  if (!email) {
    errorInvitar.value = 'Ingresa un correo electrónico'
    return
  }

  invitando.value = true
  try {
    const respuesta = await $fetch('/api/admin/invitar', {
      method: 'POST',
      body: { email, ledgerId: ledgerActivoId.value },
    })
    okInvitar.value = true
    ultimoRedirectTo.value = respuesta.redirectTo
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

async function alternarRol(userId: string, rolActual: 'member' | 'admin') {
  errorRol.value = null
  cambiandoRolId.value = userId
  try {
    await cambiarRol(userId, rolActual === 'admin' ? 'member' : 'admin')
  } catch (err) {
    errorRol.value = err instanceof Error ? err.message : 'No se pudo cambiar el rol'
  } finally {
    cambiandoRolId.value = null
  }
}

const usuarioAQuitar = ref<{ userId: string; nombre: string } | null>(null)
const quitando = ref(false)
const errorQuitar = ref<string | null>(null)

function pedirQuitar(u: { userId: string; nombre: string | null; email: string | null }) {
  errorQuitar.value = null
  usuarioAQuitar.value = { userId: u.userId, nombre: u.nombre || u.email || 'este usuario' }
}

async function confirmarQuitar() {
  if (!usuarioAQuitar.value) return
  quitando.value = true
  errorQuitar.value = null
  try {
    await $fetch('/api/admin/quitar-miembro', {
      method: 'POST',
      body: { userId: usuarioAQuitar.value.userId, ledgerId: ledgerActivoId.value },
    })
    usuarioAQuitar.value = null
    await fetchUsuarios()
  } catch (err) {
    errorQuitar.value = extraerMensaje(err)
  } finally {
    quitando.value = false
  }
}
</script>

<template>
  <div class="stack">
    <h1>Usuarios</h1>
    <p class="text-muted">
      Invita a los miembros de este ledger por correo y elige quiénes tienen permisos de
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
    <p v-if="okInvitar" class="alert alert-ok">
      Listo.
      <span v-if="ultimoRedirectTo" class="text-muted redirect-preview">
        Enlace configurado a: {{ ultimoRedirectTo }}
      </span>
    </p>
    <p v-if="errorRol" class="alert alert-error">{{ errorRol }}</p>
    <p v-if="errorQuitar" class="alert alert-error">{{ errorQuitar }}</p>

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
          <tr v-for="u in usuarios" :key="u.user_id">
            <td>{{ u.profile.full_name || '(sin completar)' }}</td>
            <td>{{ u.profile.email }}</td>
            <td>
              <span class="badge badge-role">{{ u.role }}</span>
            </td>
            <td class="row acciones">
              <span v-if="u.user_id === profile?.id" class="text-muted tu-cuenta">Tú</span>
              <template v-else>
                <button
                  type="button"
                  class="btn btn-ghost"
                  :disabled="cambiandoRolId === u.user_id"
                  @click="alternarRol(u.user_id, u.role)"
                >
                  {{ u.role === 'admin' ? 'Quitar admin' : 'Hacer admin' }}
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-danger"
                  @click="pedirQuitar({ userId: u.user_id, nombre: u.profile.full_name, email: u.profile.email })"
                >
                  Quitar del ledger
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmModal
      :abierto="!!usuarioAQuitar"
      titulo="Quitar del ledger"
      :mensaje="`¿Quitar a ${usuarioAQuitar?.nombre} de este ledger? Pierde el acceso a este ledger de inmediato (sigue teniendo su cuenta y otros ledgers, si los tiene). Los movimientos ya cargados no se borran.`"
      texto-confirmar="Quitar"
      peligroso
      :procesando="quitando"
      @confirmar="confirmarQuitar"
      @cancelar="usuarioAQuitar = null"
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

.redirect-preview {
  display: block;
  font-size: 0.8rem;
  margin-top: 0.2rem;
  word-break: break-all;
}
</style>
