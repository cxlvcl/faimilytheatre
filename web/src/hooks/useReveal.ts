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
    if (!root.current || !ready) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(selector).forEach((element, index) => {
        gsap.fromTo(
          element,
          { autoAlpha: 0, filter: 'blur(5px)', y: 16 },
          {
            autoAlpha: 1,
            filter: 'blur(0px)',
            y: 0,
            duration: 0.8,
            clearProps: 'opacity,visibility,filter,transform',
            delay: Math.min(index * 0.04, 0.2),
            ease: 'power2.out',
            scrollTrigger: {
              trigger: element,
              start: 'clamp(top 92%)',
              once: true,
            },
          },
        )
      })
    }, root)
    return () => context.revert()
  }, [root, selector, ready])
}
