export default defineNuxtRouteMiddleware(async () => {
  const { ledgers, isAdminActivo, fetchLedgers, asegurarLedgerActivo } = useLedgers()
  if (!ledgers.value.length) await fetchLedgers()
  asegurarLedgerActivo()
  if (!isAdminActivo.value) {
    return navigateTo('/')
  }
})
