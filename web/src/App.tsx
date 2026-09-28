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
const FranchisePage = lazy(() => import('./pages/FranchisePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

function Shell() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  useRouteScroll()
  useEffect(() => { publicApi.pageView(location.pathname) }, [location.pathname])
  return <>
    <PageSeo />
    <SiteHeader isHome={location.pathname === '/'} menuOpen={menuOpen} openMenu={() => setMenuOpen(true)} />
    <FullscreenMenu open={menuOpen} onClosed={() => setMenuOpen(false)} />
    <main id="main-content" tabIndex={-1} inert={menuOpen}>
      <Suspense fallback={<div className={`page-fallback ${location.pathname === '/' ? 'page-fallback--home' : ''}`} aria-hidden="true" />}>
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/repertoire" element={<RepertoirePage />} />
          <Route path="/repertoire/:slug" element={<PerformancePage key={location.pathname} />} />
          <Route path="/afisha" element={<AfishaPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/franchise" element={<FranchisePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </main>
  </>
}
export default function App() {
  return <BrowserRouter><NavigationProvider><Shell /></NavigationProvider></BrowserRouter>
}
