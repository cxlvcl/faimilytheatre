import { useCallback, useEffect, useLayoutEffect, useRef, type MouseEvent } from 'react'
import gsap from 'gsap'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { waitForPageReady } from '../lib/pageTransition'
import { preloadRoute } from '../lib/routePreload'

interface Props {
  open: boolean
  onClosed: () => void
}

const socials = [
  { label: 'ВКонтакте', href: 'https://vk.ru/lmtales', path: 'M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z' },
  { label: 'Telegram', href: 'https://t.me/dobrohot_art', path: 'M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z' },
]

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
        // Opacity and scale only: a full-screen blur cannot be animated smoothly on phones.
        { autoAlpha: 0, scale: 1.04 },
        { autoAlpha: 1, scale: 1, duration: 0.75, ease: 'power2.out' },
        '-=0.08',
      )
      .fromTo('.menu-overlay__logo', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.38 })
      .fromTo(
        '.menu-overlay__item',
        { autoAlpha: 0, y: 22 },
        { autoAlpha: 1, y: 0, stagger: 0.08, duration: 0.55 },
        '-=0.2',
      )
      .fromTo(['.menu-overlay__meta', '.menu-overlay__social'], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.35 })

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
      <div className="menu-overlay__social">
        {socials.map((social) => (
          <a key={social.href} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label}>
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><path fill="currentColor" d={social.path} /></svg>
          </a>
        ))}
      </div>
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
