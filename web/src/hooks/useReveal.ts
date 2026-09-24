import { type RefObject, useLayoutEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function useReveal<T extends HTMLElement>(
  root: RefObject<T | null>,
  selector = '[data-reveal]',
  ready: unknown = true,
): void {
  useLayoutEffect(() => {
    if (!root.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(selector).forEach((element, index) => {
        gsap.fromTo(
          element,
          { autoAlpha: 0, filter: reduce ? 'blur(0px)' : 'blur(13px)', y: reduce ? 0 : 24 },
          {
            autoAlpha: 1,
            filter: 'blur(0px)',
            y: 0,
            duration: reduce ? 0.35 : 1.05,
            delay: Math.min(index * 0.04, 0.2),
            ease: 'power2.out',
            scrollTrigger: {
              trigger: element,
              start: 'top 88%',
              once: true,
            },
          },
        )
      })
    }, root)
    return () => context.revert()
  }, [root, selector, ready])
}
