import { createContext, type PropsWithChildren, useCallback, useContext } from 'react'
import { type NavigateOptions, type To, useLocation, useNavigate } from 'react-router-dom'
import { listReturnState } from '../lib/scrollPolicy'

interface NavigationValue { navigateSmooth: (to: To, options?: NavigateOptions) => void }
const NavigationContext = createContext<NavigationValue | null>(null)
export function NavigationProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const location = useLocation()
  const navigateSmooth = useCallback((to: To, options?: NavigateOptions) => {
    const path = typeof to === 'string' ? to.split(/[?#]/)[0] : to.pathname ?? ''
    const returnTo = listReturnState(location.pathname, location.key, window.scrollY, path)
    // No delayed navigation or full-screen ViewTransition snapshot during scroll.
    navigate(to, { ...options, state: { ...options?.state, ...(returnTo ? { returnTo } : {}) } })
  }, [navigate, location.pathname, location.key])
  return <NavigationContext.Provider value={{ navigateSmooth }}>{children}</NavigationContext.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export function useSmoothNavigation(): NavigationValue {
  const value = useContext(NavigationContext)
  if (!value) throw new Error('useSmoothNavigation must be used inside NavigationProvider')
  return value
}
