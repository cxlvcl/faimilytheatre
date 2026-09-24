import { useCallback, useEffect, useLayoutEffect, useRef, type MouseEvent } from 'react'
import gsap from 'gsap'
import { Link, useLocation, useNavigate } from 'react-router-dom'

interface Props {
  open: boolean
  onClosed: () => void
}

const links = [
  { label: 'Главная', path: '/' },
  { label: 'Репертуар', path: '/repertoire' },
  { label: 'Афиша', path: '/afisha' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Франшиза', path: '/franchise' },
]

const preloadPage: Record<string, () => Promise<unknown>> = {
  '/': () => import('../pages/HomePage'),
  '/repertoire': () => import('../pages/RepertoirePage'),
  '/afisha': () => import('../pages/AfishaPage'),
  '/faq': () => import('../pages/FaqPage'),
  '/franchise': () => import('../pages/FranchisePage'),
}

export function FullscreenMenu({ open, onClosed }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const closing = useRef(false)
  const navigate = useNavigate()
  const location = useLocation()

  useLayoutEffect(() => {
    if (!root.current) return
    timeline.current = gsap
      .timeline({ paused: true })
      .set(root.current, { autoAlpha: 1 })
      .fromTo('.menu-overlay__wash', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.28 })
      .fromTo(
        '.menu-overlay__background',
        { autoAlpha: 0, filter: 'blur(18px)' },
        { autoAlpha: 1, filter: 'blur(0px)', duration: 0.75, ease: 'power2.out' },
        '-=0.08',
      )
      .fromTo('.menu-overlay__logo', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.38 })
      .fromTo(
        '.menu-overlay__item',
        { autoAlpha: 0, y: 22, filter: 'blur(9px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', stagger: 0.08, duration: 0.55 },
        '-=0.2',
      )
      .fromTo('.menu-overlay__meta', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 })

    return () => {
      timeline.current?.kill()
    }
  }, [])

  useEffect(() => {
    const element = root.current
    const currentTimeline = timeline.current
    if (!element || !currentTimeline) return

    if (open) {
      closing.current = false
      gsap.set(element, { clearProps: 'opacity,visibility' })
      returnFocus.current = document.activeElement as HTMLElement
      document.body.classList.add('menu-open')
      element.removeAttribute('inert')
      currentTimeline.eventCallback('onReverseComplete', null)
      currentTimeline.timeScale(window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 8 : 1).play(0)
      const focusTimer = window.setTimeout(() => closeButton.current?.focus(), 140)
      return () => { window.clearTimeout(focusTimer); document.body.classList.remove('menu-open') }
    }

    element.setAttribute('inert', '')
  }, [open])

  const close = useCallback((path?: string) => {
    const currentTimeline = timeline.current
    if (!currentTimeline || !open || closing.current) return
    closing.current = true
    currentTimeline.pause()
    const finish = () => {
      document.body.classList.remove('menu-open')
      root.current?.setAttribute('inert', '')
      onClosed()
      if (!path || path === location.pathname) returnFocus.current?.focus({ preventScroll: true })
      else requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }))
    }
    const transition = () => {
      if (path && path !== location.pathname) navigate(path)
      else if (path) window.scrollTo({ top: 0, behavior: 'instant' })
      gsap.to(root.current, { autoAlpha: 0, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.2, onComplete: finish })
    }
    // Load route code while the opaque menu still covers the current page.
    if (path && preloadPage[path]) void preloadPage[path]().then(transition, transition)
    else transition()
  }, [open, onClosed, location.pathname, navigate])

  const followLink = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    close(path)
  }

  useEffect(() => {
    if (!open) return
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
        return
      }
      if (event.key !== 'Tab' || !root.current) return
      const focusable = Array.from(
        root.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]'),
      ).filter((element) => !element.hasAttribute('inert'))
      const first = focusable.at(0)
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    return () => document.removeEventListener('keydown', keydown)
  }, [open, close])

  return (
    <div ref={root} className="menu-overlay" role="dialog" aria-modal="true" aria-label="Меню" inert>
      <div className="menu-overlay__wash" />
      <div className="menu-overlay__background" />
      <div className="menu-overlay__veil" />
      <button ref={closeButton} className="menu-overlay__close" type="button" onClick={() => close()}>
        <span aria-hidden="true">×</span>
        <span className="sr-only">Закрыть меню</span>
      </button>
      <Link className="menu-overlay__logo" to="/" aria-label="Театр Музыки и Песка — главная"
        onPointerEnter={() => { void preloadPage['/']().catch(() => undefined) }}
        onFocus={() => { void preloadPage['/']().catch(() => undefined) }}
        onClick={(event) => followLink(event, '/')}
      ><img src="/media/logo.webp" alt="" width="90" height="90" /></Link>
      <nav className="menu-overlay__nav" aria-label="Основная навигация">
        {links.map((link) => (
          <Link
            key={link.path}
            className={`menu-overlay__item ${location.pathname === link.path ? 'is-current' : ''}`}
            to={link.path}
            aria-current={location.pathname === link.path ? 'page' : undefined}
            onPointerEnter={() => { void preloadPage[link.path]?.().catch(() => undefined) }}
            onFocus={() => { void preloadPage[link.path]?.().catch(() => undefined) }}
            onClick={(event) => followLink(event, link.path)}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="menu-overlay__meta">
        <a href="tel:+78314235804">8 (831) 423-58-04</a>
        <a href="mailto:info@teatrmip-nn.ru">info@teatrmip-nn.ru</a>
      </div>
    </div>
  )
}
