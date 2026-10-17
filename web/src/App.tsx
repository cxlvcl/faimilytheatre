import { lazy, type PropsWithChildren, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { FullscreenMenu } from './components/FullscreenMenu'
import { NavigationProvider } from './components/NavigationContext'
import { SiteHeader } from './components/SiteHeader'
import { PageSeo } from './components/PageSeo'
import { useRouteScroll } from './hooks/useRouteScroll'
import { publicApi } from './lib/api'
import { darkRoute, lightRoute, routeImports } from './lib/routePreload'
import { trackPageView } from './lib/counters'
const HomePage = lazy(routeImports.home)
const RepertoirePage = lazy(routeImports.repertoire)
const PerformancePage = lazy(routeImports.performance)
const AfishaPage = lazy(routeImports.afisha)
const FaqPage = lazy(routeImports.faq)
const ArticlesPage = lazy(routeImports.articles)
const ArticlePage = lazy(routeImports.article)
const FranchisePage = lazy(routeImports.franchise)
const NotFoundPage = lazy(routeImports.notFound)

/** The short fade is only for browser back/forward; veil and menu transitions animate the page themselves.
    Decided once per page mount, so the class never changes later and the animation never restarts. */
function RouteView({ animate, children }: PropsWithChildren<{ animate: boolean }>) {
  const [enter] = useState(() => {
    if (!animate || typeof document === 'undefined') return false
    const { transition, menuTransition } = document.documentElement.dataset
    return !transition && !menuTransition
  })
  return <div className={enter ? 'route-view route-view--enter' : 'route-view'}>{children}</div>
}

function Shell() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  // The first history entry is "default"; every in-app navigation gets a new key.
  const animate = location.key !== 'default'
  useRouteScroll()
  useEffect(() => { publicApi.pageView(location.pathname); trackPageView() }, [location.pathname])
  return <>
    <PageSeo />
    <SiteHeader isHome={location.pathname === '/'} light={lightRoute(location.pathname)} menuOpen={menuOpen} openMenu={() => setMenuOpen(true)} />
    <FullscreenMenu open={menuOpen} onClosed={() => setMenuOpen(false)} />
    <main id="main-content" tabIndex={-1} inert={menuOpen}>
      <Suspense fallback={<div className={`page-fallback ${darkRoute(location.pathname) ? 'page-fallback--home' : ''}`} aria-hidden="true" />}>
        <RouteView key={location.pathname} animate={animate}>
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/repertoire" element={<RepertoirePage />} />
          <Route path="/repertoire/:slug" element={<PerformancePage key={location.pathname} />} />
          <Route path="/afisha" element={<AfishaPage />} />
          <Route path="/articles" element={<ArticlesPage />} />
          <Route path="/articles/:slug" element={<ArticlePage key={location.pathname} />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/franchise" element={<FranchisePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </RouteView>
      </Suspense>
    </main>
  </>
}
export default function App() {
  return <BrowserRouter><NavigationProvider><Shell /></NavigationProvider></BrowserRouter>
}
