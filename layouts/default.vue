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
      <div class="container row masthead">
        <div class="masthead-title">
          <NuxtLink to="/" class="brand">Contabilify</NuxtLink>
          <span class="brand-sub">· El Chirin</span>
        </div>

        <div class="spacer" />

        <span v-if="profile" class="badge badge-role">{{ profile.role }}</span>
        <NuxtLink to="/perfil" class="btn btn-ghost">{{ profile?.full_name?.split(' ')[0] || 'Mi perfil' }}</NuxtLink>
        <button class="btn btn-ghost" @click="cerrarSesion">Salir</button>
      </div>

      <nav class="container row nav-links">
        <NuxtLink to="/">Carga rápida</NuxtLink>
        <NuxtLink to="/movimientos">Movimientos</NuxtLink>
        <NuxtLink v-if="isAdmin" to="/entidades">Entidades</NuxtLink>
        <NuxtLink v-if="isAdmin" to="/cuentas">Cuentas</NuxtLink>
        <NuxtLink v-if="isAdmin" to="/usuarios">Usuarios</NuxtLink>
      </nav>
    </header>

    <main class="container">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.app-header {
  background: var(--color-surface);
  position: sticky;
  top: 0;
  z-index: 10;
}

.masthead {
  padding-top: 1rem;
  padding-bottom: 1rem;
  border-bottom: 4px double var(--color-text);
  align-items: baseline;
  flex-wrap: wrap;
}

.masthead-title {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
}

.brand {
  font-family: var(--font-heading);
  font-weight: 800;
  font-size: 2rem;
  color: var(--color-text);
  text-decoration: none;
  letter-spacing: 0.3px;
}

.brand-sub {
  font-family: var(--font-body);
  font-style: italic;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.nav-links {
  border-bottom: 1px solid var(--color-border);
  padding-top: 0.65rem;
  padding-bottom: 0.65rem;
  gap: 1.3rem;
  flex-wrap: wrap;
}

.nav-links a {
  color: var(--color-text-muted);
  text-decoration: none;
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border-bottom: 3px solid transparent;
  padding-bottom: 0.4em;
}

.nav-links a.router-link-exact-active {
  color: var(--color-text);
  border-bottom: 3px solid var(--color-primary);
}

@media (max-width: 640px) {
  .nav-links {
    gap: 1rem;
  }
}
</style>
