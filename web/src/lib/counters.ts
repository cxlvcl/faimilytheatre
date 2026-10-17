/**
 * Yandex Metrika and the VK Ads pixel. The ids come from «Настройки SEO» (server-rendered
 * window.__THEATRE_COUNTERS__); without them nothing loads. The scripts load after the intro,
 * when the page is idle, so they never compete with the first render (PageSpeed).
 */
type Counters = { ym?: string; vk?: string }
type Ym = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number }
declare global {
  interface Window { __THEATRE_COUNTERS__?: Counters; ym?: Ym; _tmr?: unknown[] }
}

let started = false
let firstPage = true

function ids(): Counters {
  return typeof window === 'undefined' ? {} : window.__THEATRE_COUNTERS__ ?? {}
}

function script(src: string, id: string) {
  if (document.getElementById(id)) return
  const tag = document.createElement('script')
  tag.id = id
  tag.async = true
  tag.src = src
  document.head.append(tag)
}

function whenIdle(run: () => void) {
  const idle = () => typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(run, { timeout: 4000 }) : window.setTimeout(run, 1500)
  const afterIntro = () => document.body.classList.contains('intro-active') || document.documentElement.classList.contains('intro-pending')
    ? window.addEventListener('theatre:intro-complete', idle, { once: true })
    : idle()
  if (document.readyState === 'complete') afterIntro()
  else window.addEventListener('load', afterIntro, { once: true })
}

export function startCounters(): void {
  const { ym, vk } = ids()
  if (started || (!ym && !vk)) return
  started = true
  // Standard queue stubs: calls made before the scripts arrive are kept.
  if (ym) {
    const stub: Ym = window.ym ?? Object.assign((...args: unknown[]) => { (stub.a ??= []).push(args) }, { l: Date.now() })
    window.ym = stub
    stub(Number(ym), 'init', { webvisor: true, clickmap: true, accurateTrackBounce: true, trackLinks: true })
  }
  if (vk) {
    window._tmr ??= []
    window._tmr.push({ id: vk, type: 'pageView', start: Date.now() })
  }
  whenIdle(() => {
    if (ym) script('https://mc.yandex.ru/metrika/tag.js', 'theatre-metrika')
    if (vk) script('https://top-fwz1.mail.ru/js/code.js', 'tmr-code')
  })
}

/** In-app navigation: the first page is counted by the init calls above. */
export function trackPageView(): void {
  if (firstPage) { firstPage = false; return }
  const { ym, vk } = ids()
  if (ym && window.ym) window.ym(Number(ym), 'hit', location.href, { title: document.title, referer: document.referrer })
  if (vk && window._tmr) window._tmr.push({ id: vk, type: 'pageView', url: location.href, start: Date.now() })
}

/** Goal «buy_click» on every «Купить билет» with the performance and the date. */
export function trackBuy(performance: string, date: string): void {
  const { ym, vk } = ids()
  const params = { performance, date }
  if (ym && window.ym) window.ym(Number(ym), 'reachGoal', 'buy_click', params)
  if (vk && window._tmr) window._tmr.push({ type: 'reachGoal', id: vk, goal: 'buy_click', params })
}
