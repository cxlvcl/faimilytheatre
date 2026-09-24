import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useRef,
  useEffect,
} from 'react'
import { type NavigateOptions, type To, useNavigate } from 'react-router-dom'

interface NavigationValue {
  navigateSmooth: (to: To, options?: NavigateOptions) => void
}

const NavigationContext = createContext<NavigationValue | null>(null)

export function NavigationProvider({ children }: PropsWithChildren) {
  const navigate = useNavigate()
  const fallbackTimer = useRef<number | null>(null)
  const transition = useRef<ViewTransition | null>(null)
  useEffect(() => () => { if (fallbackTimer.current !== null) clearTimeout(fallbackTimer.current); transition.current?.skipTransition(); document.documentElement.classList.remove('route-is-leaving') }, [])

  const navigateSmooth = useCallback(
    (to: To, options?: NavigateOptions) => {
      if (fallbackTimer.current !== null) window.clearTimeout(fallbackTimer.current)

      if (document.startViewTransition) {
        transition.current?.skipTransition()
        transition.current = document.startViewTransition(() => navigate(to, options))
        void transition.current.finished.catch(() => undefined)
        return
      }

      document.documentElement.classList.add('route-is-leaving')
      fallbackTimer.current = window.setTimeout(() => {
        navigate(to, options)
        requestAnimationFrame(() => document.documentElement.classList.remove('route-is-leaving'))
        fallbackTimer.current = null
      }, 220)
    },
    [navigate],
  )

  return <NavigationContext.Provider value={{ navigateSmooth }}>{children}</NavigationContext.Provider>
}

// This context intentionally co-locates its consumer hook.
// eslint-disable-next-line react-refresh/only-export-components
export function useSmoothNavigation(): NavigationValue {
  const value = useContext(NavigationContext)
  if (!value) throw new Error('useSmoothNavigation must be used inside NavigationProvider')
  return value
}
