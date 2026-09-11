export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  const publicPaths = new Set(['/login'])

  if (!loggedIn.value && !publicPaths.has(to.path)) {
    return navigateTo(`/login?next=${encodeURIComponent(to.fullPath)}`)
  }

  if (loggedIn.value && to.path === '/login') {
    return navigateTo('/')
  }
})
