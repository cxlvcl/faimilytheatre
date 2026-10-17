import { type RefObject, useLayoutEffect } from 'react'
import gsap from 'gsap'

/**
 * Soft reveal on entering the viewport. IntersectionObserver also reports
 * elements that are already visible on first paint, so nothing stays hidden
 * until the visitor scrolls (ScrollTrigger missed those on initial load).
 */
export function useReveal<T extends HTMLElement>(
  root: RefObject<T | null>,
  selector = '[data-reveal]',
  ready: unknown = true,
): void {
  useLayoutEffect(() => {
    const element = root.current
    if (!element || !ready) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const targets = gsap.utils.toArray<HTMLElement>(selector, element)
    // Opacity and transform only: a blur would repaint every revealed block each frame.
    gsap.set(targets, { autoAlpha: 0, y: 16 })
    let batch = 0
    let frame = 0
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        observer.unobserve(entry.target)
        gsap.to(entry.target, {
          autoAlpha: 1, y: 0, duration: 0.8, ease: 'power2.out',
          delay: Math.min(batch++ * 0.06, 0.3),
          clearProps: 'opacity,visibility,filter,transform',
        })
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => { batch = 0 })
    }, { rootMargin: '0px 0px -8% 0px' })
    targets.forEach(target => observer.observe(target))
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      gsap.killTweensOf(targets)
      gsap.set(targets, { clearProps: 'opacity,visibility,filter,transform' })
    }
  }, [root, selector, ready])
}
