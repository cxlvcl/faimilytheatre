import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from 'react-router-dom'
import { FullscreenMenu } from './components/FullscreenMenu'
import { NavigationProvider } from './components/NavigationContext'
import { SiteHeader } from './components/SiteHeader'
import { publicApi } from './lib/api'

const HomePage = lazy(() => import('./pages/HomePage'))
const RepertoirePage = lazy(() => import('./pages/RepertoirePage'))
const PerformancePage = lazy(() => import('./pages/PerformancePage'))
const AfishaPage = lazy(() => import('./pages/AfishaPage'))
const FaqPage = lazy(() => import('./pages/FaqPage'))
const FranchisePage = lazy(() => import('./pages/FranchisePage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const scrollPositions = new Map<string, number>()

function Shell() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const [menuOpen, setMenuOpen] = useState(false)
  const page = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const element = page.current
    history.scrollRestoration = 'manual'
    const saved = scrollPositions.get(location.key)
    let restoreFrame = 0
    let cancelled = false
    const cancelRestore = () => { cancelled = true; cancelAnimationFrame(restoreFrame) }
    if (navigationType === 'POP' && saved !== undefined) {
      const started = performance.now()
      const restore = () => {
        if (cancelled) return
        window.scrollTo({ top: saved, behavior: 'instant' })
        if (document.documentElement.scrollHeight < saved + innerHeight && performance.now() - started < 8000) restoreFrame = requestAnimationFrame(restore)
      }
      restore()
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }

    window.addEventListener('wheel', cancelRestore, { once: true, passive: true })
    window.addEventListener('touchstart', cancelRestore, { once: true, passive: true })
    if (!element) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Home owns its black intro; a second page fade must not expose a light fallback.
    const tween = location.pathname === '/' ? null : gsap.fromTo(
      element,
      { autoAlpha: reduce ? 1 : 0.85 },
      { autoAlpha: 1, duration: reduce ? 0 : 0.2, ease: 'power2.out', clearProps: 'opacity,visibility' },
    )

    return () => {
      tween?.kill()
      cancelRestore()
      window.removeEventListener('wheel', cancelRestore)
      window.removeEventListener('touchstart', cancelRestore)
      gsap.set(element, { clearProps: 'filter,opacity,visibility' })
      scrollPositions.set(location.key, window.scrollY)
    }
  }, [location.key, location.pathname, navigationType])

  useEffect(() => {
    publicApi.pageView(location.pathname)
  }, [location.pathname])

  return (
    <>
      <SiteHeader
        isHome={location.pathname === '/'}
        menuOpen={menuOpen}
        openMenu={() => setMenuOpen(true)}
      />
      <FullscreenMenu open={menuOpen} onClosed={() => setMenuOpen(false)} />
      <main ref={page} id="main-content" tabIndex={-1} inert={menuOpen}>
        <Suspense fallback={<div className={`page-fallback ${location.pathname === '/' ? 'page-fallback--home' : ''}`} aria-hidden="true" />}>
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/repertoire" element={<RepertoirePage />} />
            <Route path="/repertoire/:slug" element={<PerformancePage />} />
            <Route path="/afisha" element={<AfishaPage />} />
            <Route path="/faq" element={<FaqPage />} />
            <Route path="/franchise" element={<FranchisePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <NavigationProvider>
        <Shell />
      </NavigationProvider>
    </BrowserRouter>
  )
}
