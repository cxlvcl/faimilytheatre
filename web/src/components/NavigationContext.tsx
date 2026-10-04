import { createContext, type PropsWithChildren, useCallback, useContext, useEffect } from 'react'
import { type NavigateOptions, type To, useLocation, useNavigate } from 'react-router-dom'
import { listReturnState } from '../lib/scrollPolicy'
import { runTransition } from '../lib/pageTransition'
import { preloadRoute } from '../lib/routePreload'

interface NavigationValue {
  navigateSmooth: (to: To, options?: NavigateOptions) => void
  goBack: (fallback: To, options?: NavigateOptions, useHistory?: boolean) => void
}
const NavigationContext = createContext<NavigationValue | null>(null)
const historyPaths = new Map<number, string>()
export function NavigationProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (typeof window === 'undefined') return
    const index = (window.history.state as { idx?: number } | null)?.idx
    if (typeof index === 'number') historyPaths.set(index, location.pathname)
  }, [location.pathname, location.key])

  const navigateSmooth = useCallback((to: To, options?: NavigateOptions) => {
    const path = typeof to === 'string' ? to.split(/[?#]/)[0] : to.pathname ?? ''
    const returnTo = listReturnState(location.pathname, location.key, window.scrollY, path)
    const change = () => navigate(to, { ...options, state: { ...options?.state, ...(returnTo ? { returnTo } : {}) } })
    if (path === location.pathname) change()
    else void runTransition(change, path, preloadRoute(path))
  }, [navigate, location.pathname, location.key])

  const goBack = useCallback((fallback: To, options?: NavigateOptions, useHistory = true) => {
    const index = typeof window === 'undefined' ? 0 : (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (useHistory && index > 0) {
      const destination = historyPaths.get(index - 1) ?? null
      void runTransition(() => navigate(-1), destination, destination ? preloadRoute(destination) : undefined)
      return
    }
    navigateSmooth(fallback, options)
  }, [navigate, navigateSmooth])

  return <NavigationContext.Provider value={{ navigateSmooth, goBack }}>{children}<div className="route-veil" aria-hidden="true"><span className="route-veil__mark" /></div></NavigationContext.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export function useSmoothNavigation(): NavigationValue {
  const value = useContext(NavigationContext)
  if (!value) throw new Error('useSmoothNavigation must be used inside NavigationProvider')
  return value
}
