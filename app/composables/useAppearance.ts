import {
  normalizeMotionPreference,
  normalizeThemePreference,
  type MotionPreference,
  type ThemePreference,
} from '#shared/constants'

/**
 * The account's theme / animation preferences as shared client state.
 *
 * Seeded from the session user (so SSR renders the right theme on the very
 * first paint) and kept in sync whenever the session changes (login, saving
 * the account form, restoring a backup). The account page also writes to it
 * directly to preview a choice before it is saved.
 */
export function useAppearance() {
  const { user } = useUserSession()

  const theme = useState<ThemePreference>('appearance-theme', () =>
    normalizeThemePreference(user.value?.themePreference),
  )
  const motion = useState<MotionPreference>('appearance-motion', () =>
    normalizeMotionPreference(user.value?.motionPreference),
  )

  watch(
    () => [user.value?.themePreference, user.value?.motionPreference] as const,
    ([nextTheme, nextMotion]) => {
      theme.value = normalizeThemePreference(nextTheme)
      motion.value = normalizeMotionPreference(nextMotion)
    },
  )

  return { theme, motion }
}
