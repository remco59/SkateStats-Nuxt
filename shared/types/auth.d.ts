// Module augmentation for nuxt-auth-utils (plan section 8: nuxt-auth-utils
// is the committed auth mechanism, not a placeholder).
declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    skaterName: string
    isAdmin: boolean
    sessionVersion: number
  }
}

export {}
