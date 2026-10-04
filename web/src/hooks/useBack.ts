import { useLocation } from 'react-router-dom'
import { useSmoothNavigation } from '../components/NavigationContext'

/** Where «Назад» leads when the visitor opened the page directly, without an earlier page of the site. */
export function parentOf(pathname: string): { path: string; focus?: string } {
  const show = pathname.match(/^\/repertoire\/([^/]+)$/)
  if (show) return { path: '/repertoire', focus: `show-${show[1]}` }
  if (/^\/articles\/[^/]+$/.test(pathname)) return { path: '/articles' }
  return { path: '/' }
}

/** Back within the site keeps the previous scroll position (see useRouteScroll); otherwise go to the parent page. */
export function useBack() {
  const location = useLocation()
  const { goBack } = useSmoothNavigation()
  return () => {
    const parent = parentOf(location.pathname)
    goBack(parent.path, parent.focus ? { state: { focus: parent.focus } } : undefined)
  }
}
