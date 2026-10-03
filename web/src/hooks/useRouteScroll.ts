import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { scrollDestination, type ReturnToList } from '../lib/scrollPolicy'

export function useRouteScroll() {
  const location = useLocation()
  const navigation = useNavigationType()
  const previous = useRef<{ pathname: string; returnTo?: ReturnToList }>({ pathname: '' })
  useLayoutEffect(() => {
    history.scrollRestoration = 'manual'
    const y = scrollDestination(navigation, previous.current.pathname, location.pathname, location.key, previous.current.returnTo)
    // «Назад» from a directly opened performance lands on the list at that performance.
    const focus = typeof location.state?.focus === 'string' ? location.state.focus : ''
    previous.current = { pathname: location.pathname, returnTo: location.state?.returnTo }
    let frame = 0
    let stopped = false
    let timer = 0
    const stop = () => {
      stopped = true
      cancelAnimationFrame(frame)
      observer?.disconnect()
      resize?.disconnect()
      clearTimeout(timer)
    }
    const restore = () => {
      if (stopped) return
      const target = focus ? document.getElementById(focus) : null
      const top = target ? Math.max(0, Math.round(target.getBoundingClientRect().top + window.scrollY)) : y
      window.scrollTo({ top, behavior: 'instant' })
      const loading = document.querySelector('.page-fallback, .page-wash')
      if (!loading && (!focus || target) && document.documentElement.scrollHeight >= top + innerHeight - 2) stop()
    }
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(restore) }
    const observer = new MutationObserver(schedule)
    observer.observe(document.getElementById('main-content')!, { childList: true, subtree: true })
    const resize = new ResizeObserver(schedule)
    resize.observe(document.body)
    timer = window.setTimeout(stop, 5000)
    // Layout changes, rather than an eight-second polling loop, trigger retries.
    window.scrollTo({ top: y, behavior: 'instant' })
    schedule()
    const cancelKeys = (event: KeyboardEvent) => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) stop() }
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchstart', stop, { passive: true })
    window.addEventListener('keydown', cancelKeys)
    return () => {
      stop()
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchstart', stop)
      window.removeEventListener('keydown', cancelKeys)
    }
  }, [location.key, location.pathname, location.state, navigation])
}
