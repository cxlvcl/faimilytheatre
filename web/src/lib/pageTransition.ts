import { darkRoute } from './routePreload'

let running = false

function nextFrame(timeout = 2000): Promise<void> {
  return new Promise(resolve => {
    let finished = false
    const frame = requestAnimationFrame(finish)
    const timer = window.setTimeout(finish, timeout)
    function finish() {
      if (finished) return
      finished = true
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
      resolve()
    }
  })
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

async function twoFrames(deadline: number): Promise<void> {
  await nextFrame(Math.max(0, deadline - performance.now()))
  await nextFrame(Math.max(0, deadline - performance.now()))
}

export async function waitForPageReady(): Promise<void> {
  const started = performance.now()
  const deadline = started + 2000

  while (performance.now() < deadline) {
    const main = document.getElementById('main-content')
    if (main && !main.querySelector('.page-fallback, .page-wash')) {
      await twoFrames(deadline)
      if (!main.querySelector('.page-fallback, .page-wash')) {
        const image = main.querySelector<HTMLImageElement>('img[fetchpriority="high"]')
        if (image && !image.complete) {
          const highPriorityImage = image
          await new Promise<void>(resolve => {
            const timeout = window.setTimeout(finish, Math.min(700, Math.max(0, deadline - performance.now())))
            function finish() {
              window.clearTimeout(timeout)
              highPriorityImage.removeEventListener('load', finish)
              highPriorityImage.removeEventListener('error', finish)
              resolve()
            }
            highPriorityImage.addEventListener('load', finish)
            highPriorityImage.addEventListener('error', finish)
          })
        }
        return
      }
    }
    await nextFrame(Math.min(50, Math.max(0, deadline - performance.now())))
  }
}

export async function runTransition(
  change: () => void,
  destination: string | null,
  preload?: Promise<unknown>,
): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    change()
    return
  }
  if (running) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    change()
    return
  }

  running = true
  const html = document.documentElement
  const veil = destination && !darkRoute(destination) ? 'light' : 'dark'
  html.dataset.veil = veil
  html.style.setProperty('--veil-color', veil === 'light' ? '#fff' : '#080808')
  const slowTimer = window.setTimeout(() => {
    if (html.dataset.transition === 'out' || html.dataset.transition === 'cover') {
      html.dataset.transitionSlow = ''
    }
  }, 400)
  try {
    html.dataset.transition = 'out'
    await Promise.allSettled([delay(350), preload ?? Promise.resolve()])
    html.dataset.transition = 'cover'
    change()
    await waitForPageReady()
    delete html.dataset.transitionSlow
    html.dataset.transition = 'reveal'
    await delay(700)
  } finally {
    window.clearTimeout(slowTimer)
    delete html.dataset.transitionSlow
    delete html.dataset.transition
    delete html.dataset.veil
    html.style.removeProperty('--veil-color')
    document.querySelector<HTMLElement>('.route-view')?.style.removeProperty('transform')
    running = false
  }
}
