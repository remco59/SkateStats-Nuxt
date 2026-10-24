// Module augmentation for nuxt-auth-utils (plan section 8: nuxt-auth-utils
// is the committed auth mechanism, not a placeholder).
import type { MotionPreference, ThemePreference } from '../constants'

declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    skaterName: string
    isAdmin: boolean
    sessionVersion: number
    // Optional: sessions issued before these existed don't carry them.
    themePreference?: ThemePreference
    motionPreference?: MotionPreference
  }
}

export {}
