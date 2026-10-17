import { publicRequest } from './api'

export const routeImports = {
  home: () => import('../pages/HomePage'),
  repertoire: () => import('../pages/RepertoirePage'),
  performance: () => import('../pages/PerformancePage'),
  afisha: () => import('../pages/AfishaPage'),
  faq: () => import('../pages/FaqPage'),
  articles: () => import('../pages/ArticlesPage'),
  article: () => import('../pages/ArticlePage'),
  franchise: () => import('../pages/FranchisePage'),
  notFound: () => import('../pages/NotFoundPage'),
}

export function darkRoute(path: string): boolean {
  // The performance page is a light «newspaper» page; the repertoire list and afisha are dark.
  return path === '/' || path === '/franchise' || path === '/repertoire' || path === '/afisha'
}

/** Pages on a white background: FAQ, articles and a performance's «newspaper» page. */
export function lightRoute(path: string): boolean {
  return /^\/(faq|articles)(\/|$)|^\/repertoire\/[^/]+/.test(path)
}

export function preloadRoute(path: string): Promise<unknown> {
  const pathname = path.split(/[?#]/)[0] || '/'
  let load = routeImports.notFound
  const data: Promise<unknown>[] = []

  if (pathname === '/') {
    load = routeImports.home
    data.push(publicRequest('/public/events'))
  }
  else if (pathname === '/repertoire') {
    load = routeImports.repertoire
    data.push(publicRequest('/public/performances'))
  } else if (/^\/repertoire\/[^/]+$/.test(pathname)) {
    load = routeImports.performance
    const slug = pathname.slice('/repertoire/'.length)
    data.push(publicRequest(`/public/performances/${encodeURIComponent(slug)}`), publicRequest('/public/events'))
  } else if (pathname === '/afisha') {
    load = routeImports.afisha
    data.push(publicRequest('/public/events'))
  } else if (pathname === '/faq') {
    load = routeImports.faq
    data.push(publicRequest('/public/faq'))
  } else if (pathname === '/articles') {
    load = routeImports.articles
    data.push(publicRequest('/public/articles'))
  } else if (/^\/articles\/[^/]+$/.test(pathname)) {
    load = routeImports.article
    const slug = pathname.slice('/articles/'.length)
    data.push(publicRequest(`/public/articles/${encodeURIComponent(slug)}`))
  } else if (pathname === '/franchise') load = routeImports.franchise

  const warmData = Promise.all(data.map(request => request.catch(() => undefined)))
  return Promise.all([load(), warmData])
}

type Connection = { saveData?: boolean; effectiveType?: string }
function canWarm(): boolean {
  const connection = (navigator as Navigator & { connection?: Connection }).connection
  return !connection?.saveData && !/2g$/.test(connection?.effectiveType ?? '')
}

function whenIdle(): Promise<void> {
  return new Promise(resolve => {
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => resolve(), { timeout: 3000 })
    else setTimeout(resolve, 300)
  })
}

// One request at a time in idle moments: the visitor's own clicks always go first.
let queue: Promise<unknown> = Promise.resolve()
const queued = new Set<string>()
function warmLater(path: string): void {
  if (queued.has(path)) return
  queued.add(path)
  queue = queue.then(whenIdle).then(() => preloadRoute(path)).catch(() => undefined)
}

/** After the first page settles, loads the code and lists of the main pages in the background. */
export function warmRoutes(): void {
  if (typeof window === 'undefined' || !canWarm()) return
  const start = () => window.setTimeout(() => {
    for (const path of ['/repertoire', '/afisha', '/', '/articles', '/faq']) warmLater(path)
    queue = queue.then(whenIdle).then(() => Promise.all([routeImports.performance(), routeImports.article(), routeImports.franchise()])).catch(() => undefined)
  }, 2500)
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}

let observer: IntersectionObserver | undefined
/** Performance and article cards: their page data loads while the card is on screen. */
export function watchLink(element: HTMLElement, path: string): () => void {
  if (!/^\/(repertoire|articles)\/[^/]+$/.test(path) || typeof IntersectionObserver === 'undefined' || !canWarm()) return () => undefined
  observer ??= new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      observer?.unobserve(entry.target)
      const href = entry.target.getAttribute('href')
      if (href) warmLater(href.split(/[?#]/)[0])
    }
  }, { rootMargin: '0px 0px 160px 0px' })
  observer.observe(element)
  return () => observer?.unobserve(element)
}
