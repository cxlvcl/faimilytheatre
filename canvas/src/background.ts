/**
 * Fixed background: behind each painting, the same painting, soft and dark (baked into the file).
 * Scrolling from one painting to the next cross-fades the two layers; only opacity and transform change.
 */
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const smooth = (t: number) => t * t * (3 - 2 * t)

export function startBackground(reduced: () => boolean): void {
  const layers = [...document.querySelectorAll<HTMLImageElement>('.cv-bg__layer')]
  const stages = [...document.querySelectorAll<HTMLElement>('.cv-stage')]
  if (!layers.length || layers.length !== stages.length) return
  let centres: number[] = []
  let queued = false

  const measure = () => {
    centres = stages.map(stage => {
      const rect = stage.getBoundingClientRect()
      return rect.top + window.scrollY + rect.height / 2
    })
  }
  const load = (index: number) => {
    const layer = layers[index]
    if (layer?.dataset.src) {
      layer.src = layer.dataset.src
      delete layer.dataset.src
    }
  }

  const update = () => {
    queued = false
    const centre = window.scrollY + window.innerHeight / 2
    // Position between paintings: 3.4 means between the 4th and the 5th, closer to the 4th.
    let position = 0
    if (centre >= centres[centres.length - 1]) position = centres.length - 1
    else if (centre > centres[0]) {
      const index = centres.findIndex((value, i) => centre >= value && centre < centres[i + 1])
      position = index + (centre - centres[index]) / (centres[index + 1] - centres[index])
    }
    const index = Math.floor(position)
    // A long, soft cross-fade over most of the way from one painting to the next.
    const fade = smooth(clamp((position - index - 0.15) / 0.7, 0, 1))
    for (let i = index - 1; i <= index + 2; i++) load(i)
    layers.forEach((layer, i) => {
      const opacity = i === index ? 1 : i === index + 1 ? fade : 0
      layer.style.visibility = opacity === 0 ? 'hidden' : 'visible'
      layer.style.opacity = String(opacity)
      if (opacity) {
        const shift = reduced() ? 0 : clamp((centres[i] - centre) / window.innerHeight, -1, 1) * 15
        layer.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`
      }
    })
  }
  const queue = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(update)
  }
  const remeasure = () => {
    measure()
    queue()
  }
  window.addEventListener('scroll', queue, { passive: true })
  window.addEventListener('resize', remeasure)
  // Opening a text moves everything below it.
  new ResizeObserver(remeasure).observe(document.body)
  remeasure()
}
