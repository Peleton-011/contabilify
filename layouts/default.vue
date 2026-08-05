<script setup lang="ts">
const { profile, isAdmin } = useProfile()
const supabase = useSupabaseClient()
const router = useRouter()

async function cerrarSesion() {
  await supabase.auth.signOut()
  router.push('/login')
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="container row">
        <NuxtLink to="/" class="brand">Contabilify</NuxtLink>

        <nav class="row nav-links">
          <NuxtLink to="/">Carga rápida</NuxtLink>
          <NuxtLink to="/movimientos">Movimientos</NuxtLink>
          <NuxtLink v-if="isAdmin" to="/entidades">Entidades</NuxtLink>
          <NuxtLink v-if="isAdmin" to="/cuentas">Cuentas</NuxtLink>
          <NuxtLink v-if="isAdmin" to="/usuarios">Usuarios</NuxtLink>
        </nav>

        <div class="spacer" />

        <span v-if="profile" class="badge badge-role">{{ profile.role }}</span>
        <NuxtLink to="/perfil" class="btn btn-ghost">{{ profile?.full_name || 'Mi perfil' }}</NuxtLink>
        <button class="btn btn-ghost" @click="cerrarSesion">Salir</button>
      </div>
    </header>

    <main class="container">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-header {
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
  position: sticky;
  top: 0;
  z-index: 10;
}

.app-header .container {
  padding-top: 0.85rem;
  padding-bottom: 0.85rem;
}

.brand {
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--color-primary);
  text-decoration: none;
}

.nav-links {
  margin-left: 1.5rem;
  gap: 1.1rem;
}

.nav-links a {
  color: var(--color-text-muted);
  text-decoration: none;
  font-weight: 600;
  font-size: 0.92rem;
}

.nav-links a.router-link-exact-active {
  color: var(--color-primary);
}

@media (max-width: 640px) {
  .app-header .container {
    flex-wrap: wrap;
  }

  .nav-links {
    order: 3;
    margin-left: 0;
    width: 100%;
    gap: 1rem;
    padding-top: 0.5rem;
  }
}
</style>
