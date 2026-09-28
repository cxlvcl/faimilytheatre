import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import type { To } from 'react-router-dom'
import { useSmoothNavigation } from './NavigationContext'

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: To
  state?: unknown
}

export function SmoothLink({ to, state, onClick, ...props }: Props) {
  const { navigateSmooth } = useSmoothNavigation()

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

  return <a href={typeof to === 'string' ? to : undefined} onClick={handleClick} {...props} />
}
