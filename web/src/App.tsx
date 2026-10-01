import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { FullscreenMenu } from './components/FullscreenMenu'
import { NavigationProvider } from './components/NavigationContext'
import { SiteHeader } from './components/SiteHeader'
import { PageSeo } from './components/PageSeo'
import { useRouteScroll } from './hooks/useRouteScroll'
import { publicApi } from './lib/api'
const HomePage = lazy(() => import('./pages/HomePage'))
const RepertoirePage = lazy(() => import('./pages/RepertoirePage'))
const PerformancePage = lazy(() => import('./pages/PerformancePage'))
const AfishaPage = lazy(() => import('./pages/AfishaPage'))
const FaqPage = lazy(() => import('./pages/FaqPage'))
const ArticlesPage = lazy(() => import('./pages/ArticlesPage'))
const ArticlePage = lazy(() => import('./pages/ArticlePage'))
const FranchisePage = lazy(() => import('./pages/FranchisePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

// Dark pages get a dark placeholder so navigation never flashes white.
const darkRoute = (path: string) => path === '/' || path === '/franchise' || /^\/(repertoire|afisha)(\/|$)/.test(path)

function Shell() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  // The first history entry is "default"; every in-app navigation gets a new key.
  const animate = location.key !== 'default'
  useRouteScroll()
  useEffect(() => { publicApi.pageView(location.pathname) }, [location.pathname])
  return <>
    <PageSeo />
    <SiteHeader isHome={location.pathname === '/'} menuOpen={menuOpen} openMenu={() => setMenuOpen(true)} />
    <FullscreenMenu open={menuOpen} onClosed={() => setMenuOpen(false)} />
    <main id="main-content" tabIndex={-1} inert={menuOpen}>
      <Suspense fallback={<div className={`page-fallback ${darkRoute(location.pathname) ? 'page-fallback--home' : ''}`} aria-hidden="true" />}>
        <div key={location.pathname} className={animate ? 'route-view route-view--enter' : 'route-view'}>
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
        </div>
      </Suspense>
    </main>
  </>
}
export default function App() {
  return <BrowserRouter><NavigationProvider><Shell /></NavigationProvider></BrowserRouter>
}
