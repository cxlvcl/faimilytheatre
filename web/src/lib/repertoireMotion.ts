import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function setupRepertoireMotion(root: HTMLElement, kind: 'repertoire' | 'event' = 'repertoire'): () => void {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const contents = root.querySelectorAll<HTMLElement>(`.${kind}-scene__content`)
  let context: gsap.Context | undefined

  const reset = () => {
    context?.revert()
    context = undefined
    contents.forEach(content => content.style.removeProperty('will-change'))
  }
  const setup = () => {
    reset()
    // No hidden content or scroll work when the visitor requests less motion.
    if (preference.matches) return
    context = gsap.context(() => {
      const scenes = root.querySelectorAll<HTMLElement>(`.${kind}-scene`)
      scenes.forEach((scene, index) => {
        const content = scene.querySelector<HTMLElement>(`.${kind}-scene__content`)
        if (!content) return
        const updateLayer = (trigger: ScrollTrigger) => {
          if (trigger.isActive) content.style.willChange = 'transform, opacity'
          else content.style.removeProperty('will-change')
        }
        // A single timeline owns the entrance and exit: opacity and transform only, so
        // scrolling never repaints a filter (the background blur is static in CSS).
        gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: scene,
            start: 'top 88%',
            end: 'bottom 12%',
            scrub: 0.16,
            onToggle: updateLayer,
            onRefresh: updateLayer,
          },
        })
          .fromTo(content, { opacity: index === 0 ? 1 : 0.28, y: index === 0 ? 0 : 18 }, { opacity: 1, y: 0, duration: 0.22 })
          .to(content, { opacity: index === scenes.length - 1 ? 1 : 0.28, y: index === scenes.length - 1 ? 0 : -18, duration: 0.22 }, 0.78)
      })
    }, root)
  }

  setup()
  preference.addEventListener('change', setup)
  return () => {
    preference.removeEventListener('change', setup)
    reset()
  }
}
