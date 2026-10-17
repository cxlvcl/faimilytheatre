import { useLayoutEffect, useState } from 'react'
import { SmoothLink } from './SmoothLink'
import { useBack } from '../hooks/useBack'

interface Props {
  isHome: boolean
  menuOpen: boolean
  openMenu: () => void
}

export function SiteHeader({ isHome, menuOpen, openMenu }: Props) {
  const back = useBack()
  const [introActive, setIntroActive] = useState(
    () => {
      if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
      try { return isHome && sessionStorage.getItem('theatre_intro_seen') !== '1' } catch { return isHome }
    },
  )

  useLayoutEffect(() => {
    const complete = () => setIntroActive(false)
    window.addEventListener('theatre:intro-complete', complete)
    return () => window.removeEventListener('theatre:intro-complete', complete)
  }, [isHome])

  return (
    <header
      className={`site-header ${isHome && introActive ? 'is-intro' : ''}`}
      aria-hidden={menuOpen}
    >
      <button
        className="site-header__menu"
        type="button"
        onClick={openMenu}
        aria-label="Открыть меню"
        aria-expanded={menuOpen}
      >
        <span className="site-header__menu-label">Меню</span>
      </button>
      {!isHome && (
        <SmoothLink className="site-header__logo" to="/" aria-label="Театр Музыки и Песка — главная">
          <img src="/media/logo.webp" alt="" width="320" height="320" />
        </SmoothLink>
      )}
      {!isHome && (
        <button className="site-header__back" type="button" onClick={back}>
          Назад
        </button>
      )}
    </header>
  )
}
