/**
 * Scroll-reveal for cards (the old app's staggered "motion-ready" effect).
 *
 * This only tags elements and toggles classes; whether anything actually
 * hides/animates is decided purely by CSS from <html data-motion> (see
 * tokens.css), so changing the preference takes effect live and a user who
 * picks "none" never sees a hidden element.
 *
 * Tagging starts only once the first page has finished hydrating, never
 * before: `app:mounted` is NOT late enough, because pages with an async
 * setup (every page here uses `await useFetch`) hydrate under <Suspense>
 * after it fires, and touching their classes earlier triggers Vue
 * "Hydration class mismatch" warnings. `app:suspense:resolve` fires once
 * that first suspense has resolved.
 * Elements already in the viewport at that moment are marked revealed
 * straight away so the first paint doesn't flash hidden -> visible.
 */
const SELECTOR = '.card, .notice, .empty-state, .panel'

export default defineNuxtPlugin((nuxtApp) => {
  if (typeof IntersectionObserver === 'undefined') return

  const seen = new WeakSet<Element>()
  let pending = false

  const observer = new IntersectionObserver(
    (entries) => {
      let index = 0
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const el = entry.target as HTMLElement
        el.style.setProperty('--enter-index', String(Math.min(index++, 5)))
        el.classList.add('is-inview')
        observer.unobserve(el)
      }
    },
    { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
  )

  function tag(initial: boolean) {
    pending = false
    for (const el of document.querySelectorAll(SELECTOR)) {
      if (seen.has(el)) continue
      seen.add(el)
      el.classList.add('js-reveal')
      const rect = el.getBoundingClientRect()
      if (initial && rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add('is-inview')
      } else {
        observer.observe(el)
      }
    }
  }

  let started = false

  nuxtApp.hook('app:suspense:resolve', () => {
    if (started) return
    started = true
    tag(true)

    // Pages render data asynchronously and route changes swap whole trees:
    // tag whatever shows up later, batched to one pass per frame.
    new MutationObserver(() => {
      if (pending) return
      pending = true
      requestAnimationFrame(() => tag(false))
    }).observe(document.body, { childList: true, subtree: true })
  })
})
