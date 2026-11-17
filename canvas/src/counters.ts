/**
 * Yandex Metrika and the VK Ads pixel, the same counters as on the rest of the site
 * (ids from «Настройки SEO», server-rendered into window.__THEATRE_COUNTERS__). Loaded when the page is idle.
 */
type Counters = { ym?: string; vk?: string }
type Ym = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number }
declare global {
  interface Window { __THEATRE_COUNTERS__?: Counters; ym?: Ym; _tmr?: unknown[] }
}

const ids = (): Counters => window.__THEATRE_COUNTERS__ ?? {}

function script(src: string, id: string) {
  if (document.getElementById(id)) return
  const tag = document.createElement('script')
  tag.id = id
  tag.async = true
  tag.src = src
  document.head.append(tag)
}

export function startCounters(): void {
  const { ym, vk } = ids()
  if (!ym && !vk) return
  if (ym) {
    const stub: Ym = window.ym ?? Object.assign((...args: unknown[]) => { (stub.a ??= []).push(args) }, { l: Date.now() })
    window.ym = stub
    stub(Number(ym), 'init', { webvisor: true, clickmap: true, accurateTrackBounce: true, trackLinks: true })
  }
  if (vk) {
    window._tmr ??= []
    window._tmr.push({ id: vk, type: 'pageView', start: Date.now() })
  }
  const load = () => {
    if (ym) script('https://mc.yandex.ru/metrika/tag.js', 'theatre-metrika')
    if (vk) script('https://top-fwz1.mail.ru/js/code.js', 'tmr-code')
  }
  const idle = () => typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(load, { timeout: 4000 }) : window.setTimeout(load, 1500)
  if (document.readyState === 'complete') idle()
  else window.addEventListener('load', idle, { once: true })
}

export function reachGoal(goal: string, params: Record<string, string>): void {
  const { ym, vk } = ids()
  if (ym && window.ym) window.ym(Number(ym), 'reachGoal', goal, params)
  if (vk && window._tmr) window._tmr.push({ type: 'reachGoal', id: vk, goal, params })
}
