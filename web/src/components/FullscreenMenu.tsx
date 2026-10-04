import { useCallback, useEffect, useLayoutEffect, useRef, type MouseEvent } from 'react'
import gsap from 'gsap'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { waitForPageReady } from '../lib/pageTransition'
import { preloadRoute } from '../lib/routePreload'

interface Props {
  open: boolean
  onClosed: () => void
}

const links = [
  { label: 'Главная', path: '/' },
  { label: 'Репертуар', path: '/repertoire' },
  { label: 'Афиша', path: '/afisha' },
  { label: 'Статьи', path: '/articles' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Франшиза', path: '/franchise' },
]

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

  const close = useCallback((path?: string, chosen?: HTMLAnchorElement) => {
    const currentTimeline = timeline.current
    if (!currentTimeline || !open || closing.current) return
    closing.current = true
    currentTimeline.pause()
    let slowTimer: number | undefined
    if (path && path !== location.pathname) {
      root.current?.setAttribute('data-leaving', 'true')
      chosen?.setAttribute('data-chosen', 'true')
      slowTimer = window.setTimeout(() => root.current?.setAttribute('data-slow', 'true'), 900)
    }
    const finish = () => {
      if (slowTimer !== undefined) window.clearTimeout(slowTimer)
      root.current?.removeAttribute('data-leaving')
      root.current?.removeAttribute('data-slow')
      chosen?.removeAttribute('data-chosen')
      document.body.classList.remove('menu-open')
      root.current?.setAttribute('inert', '')
      onClosed()
      if (!path || path === location.pathname) returnFocus.current?.focus({ preventScroll: true })
      else requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }))
    }
    const transition = async () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (path && path !== location.pathname) {
        document.documentElement.dataset.menuTransition = 'cover'
        navigate(path)
        await waitForPageReady()
        document.documentElement.dataset.menuTransition = 'reveal'
      } else if (path) window.scrollTo({ top: 0, behavior: 'instant' })
      // A CSS transition runs on the compositor: the fade stays smooth while the new page mounts.
      const element = root.current
      const duration = reduced ? 0 : 450
      if (element) {
        element.style.transition = `opacity ${duration}ms ease`
        element.style.opacity = '0'
      }
      window.setTimeout(() => {
        element?.style.setProperty('visibility', 'hidden')
        element?.style.removeProperty('transition')
        finish()
      }, duration)
      if (path && path !== location.pathname) {
        window.setTimeout(() => { delete document.documentElement.dataset.menuTransition }, reduced ? 0 : 560)
      }
    }
    // Load route code while the opaque menu still covers the current page.
    if (path && path !== location.pathname) void preloadRoute(path).then(transition, transition)
    else void transition()
  }, [open, onClosed, location.pathname, navigate])

  const followLink = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    close(path, event.currentTarget)
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
        onPointerEnter={() => { void preloadRoute('/').catch(() => undefined) }}
        onFocus={() => { void preloadRoute('/').catch(() => undefined) }}
        onClick={(event) => followLink(event, '/')}
      ><img src="/media/logo.webp" alt="" width="90" height="90" /></Link>
      <nav className="menu-overlay__nav" aria-label="Основная навигация">
        {links.map((link) => (
          <Link
            key={link.path}
            className={`menu-overlay__item ${location.pathname === link.path ? 'is-current' : ''}`}
            to={link.path}
            aria-current={location.pathname === link.path ? 'page' : undefined}
            onPointerEnter={() => { void preloadRoute(link.path).catch(() => undefined) }}
            onFocus={() => { void preloadRoute(link.path).catch(() => undefined) }}
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
