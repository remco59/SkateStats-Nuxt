/**
 * Concrete (resolved) colours for canvas charts.
 *
 * The CSS tokens use light-dark(), and getPropertyValue('--color-accent')
 * returns that function text unresolved -- ECharts can't parse it. So we
 * resolve each token the way the browser does for a real property: apply it
 * to a probe element and read the computed value back as rgb()/rgba().
 * Re-resolved when the theme attribute changes or the OS scheme flips
 * (relevant for the `system` theme).
 */
const FALLBACK = { accent: '#6db0ff', border: 'rgba(190, 215, 240, 0.14)', textMuted: '#a9bccd' }

export function useThemeColors() {
  const colors = reactive({ ...FALLBACK })

  function resolve() {
    const probe = document.createElement('span')
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    document.documentElement.appendChild(probe)
    const read = (prop: 'color' | 'borderTopColor', token: string) => {
      probe.style.color = ''
      probe.style.borderTopColor = ''
      probe.style[prop] = `var(${token})`
      return getComputedStyle(probe)[prop]
    }
    colors.accent = read('color', '--color-accent') || FALLBACK.accent
    colors.textMuted = read('color', '--color-text-muted') || FALLBACK.textMuted
    probe.style.borderTopStyle = 'solid'
    colors.border = read('borderTopColor', '--color-border') || FALLBACK.border
    probe.remove()
  }

  let stop: (() => void) | null = null

  onMounted(() => {
    resolve()

    const observer = new MutationObserver(resolve)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const media = window.matchMedia('(prefers-color-scheme: light)')
    media.addEventListener('change', resolve)

    stop = () => {
      observer.disconnect()
      media.removeEventListener('change', resolve)
    }
  })

  onUnmounted(() => stop?.())

  return colors
}
