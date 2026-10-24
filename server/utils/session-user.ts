import type { User } from '#auth-utils'
import { normalizeMotionPreference, normalizeThemePreference } from '../../shared/constants'
import type { users } from '../db/schema'

/**
 * The one place that decides what goes into the sealed session cookie, so
 * login / profile update / password change can't drift apart. The
 * appearance preferences live in the session so the server can render the
 * right theme on the very first paint (no flash of the wrong colours).
 */
export function toSessionUser(user: typeof users.$inferSelect): User {
  return {
    id: user.id,
    username: user.username,
    skaterName: user.skaterName,
    isAdmin: user.isAdmin,
    sessionVersion: user.sessionVersion,
    themePreference: normalizeThemePreference(user.themePreference),
    motionPreference: normalizeMotionPreference(user.motionPreference),
  }
}
