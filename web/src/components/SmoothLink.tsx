import { type AnchorHTMLAttributes, type FocusEvent, type MouseEvent, type PointerEvent, type TouchEvent, useEffect, useRef } from 'react'
import { type To, useLocation } from 'react-router-dom'
import { preloadRoute, watchLink } from '../lib/routePreload'
import { useSmoothNavigation } from './NavigationContext'

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: To
  state?: unknown
}

export function SmoothLink({
  to,
  state,
  onClick,
  onPointerEnter,
  onFocus,
  onTouchStart,
  ...props
}: Props) {
  const { navigateSmooth } = useSmoothNavigation()
  const location = useLocation()
  const link = useRef<HTMLAnchorElement>(null)
  useEffect(() => (typeof to === 'string' && link.current ? watchLink(link.current, to.split(/[?#]/)[0]) : undefined), [to])

  const preload = () => {
    if (
      typeof to !== 'string' ||
      !to.startsWith('/') ||
      props.target === '_blank' ||
      props.download !== undefined
    ) return
    const path = to.split(/[?#]/)[0] || '/'
    if (path !== location.pathname) void preloadRoute(path).catch(() => undefined)
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      (props.target && props.target !== '_self') ||
      props.download !== undefined ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    event.preventDefault()
    navigateSmooth(to, { state })
  }

  const handlePointerEnter = (event: PointerEvent<HTMLAnchorElement>) => {
    onPointerEnter?.(event)
    preload()
  }

  const handleFocus = (event: FocusEvent<HTMLAnchorElement>) => {
    onFocus?.(event)
    preload()
  }

  const handleTouchStart = (event: TouchEvent<HTMLAnchorElement>) => {
    onTouchStart?.(event)
    preload()
  }

  return (
    <a
      ref={link}
      href={typeof to === 'string' ? to : undefined}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onFocus={handleFocus}
      onTouchStart={handleTouchStart}
      {...props}
    />
  )
}
