export default defineNuxtRouteMiddleware(async () => {
  const { profile, fetchProfile } = useProfile()
  if (!profile.value) await fetchProfile()
  if (profile.value?.role !== 'admin') {
    return navigateTo('/')
  }
})
