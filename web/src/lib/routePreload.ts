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

export function preloadRoute(path: string): Promise<unknown> {
  const pathname = path.split(/[?#]/)[0] || '/'
  let load = routeImports.notFound
  const data: Promise<unknown>[] = []

  if (pathname === '/') load = routeImports.home
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
