import './canvas.css'
import { Painting, type View3D } from './painting'
import { startBackground } from './background'
import { reachGoal, startCounters } from './counters'

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
const reduced = () => reducedQuery.matches
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const MAX_ZOOM = 2.5
const SPRING_DELAY = 2000
const AUTO_TURN = { angle: 12, duration: 1800 }
// hidden="until-found": folded texts stay findable with Ctrl+F and open by themselves.
const untilFound = 'onbeforematch' in document.body

const paintings = [...document.querySelectorAll<HTMLElement>('.cv-work')].map((el, index) => new Painting(el, index))
const hint = document.querySelector<HTMLElement>('.cv-hint')
let view3d: View3D | null = null

// ---------- Frame loop: runs only while something moves ----------
const animating = new Set<Painting>()
const dirty = new Set<Painting>()
let frame = 0
let last = 0

function wake() {
  if (frame) return
  last = performance.now()
  frame = requestAnimationFrame(tick)
}
function invalidate(painting: Painting) {
  dirty.add(painting)
  wake()
}
function animate(painting: Painting) {
  animating.add(painting)
  invalidate(painting)
}

function tick(now: number) {
  frame = 0
  const dt = Math.min(now - last, 50)
  last = now
  for (const painting of animating) {
    if (!step(painting, dt, now)) animating.delete(painting)
    dirty.add(painting)
  }
  for (const painting of dirty) draw(painting)
  dirty.clear()
  if (animating.size) wake()
}

function draw(painting: Painting) {
  if (painting.gl && view3d) { view3d.draw(painting); return }
  // Flat fallback: the <img> tilts in CSS 3D, zoom is a plain scale.
  const y = clamp(painting.rotY + painting.autoY, -15, 15)
  const x = clamp(painting.rotX, -15, 15)
  painting.body.style.transform = painting.zoom > 1.001
    ? `scale(${painting.zoom}) translate(${(-painting.cx * 100).toFixed(3)}%, ${(-painting.cy * 100).toFixed(3)}%)`
    : x || y ? `perspective(900px) rotateX(${x.toFixed(2)}deg) rotateY(${y.toFixed(2)}deg)` : ''
}

/** One physics step; returns true while the painting still moves. */
function step(painting: Painting, dt: number, now: number): boolean {
  let moving = false
  if (!painting.held) {
    if (painting.velX || painting.velY) {
      painting.rotY += painting.velY * dt
      painting.rotX += painting.velX * dt
      const decay = Math.exp(-dt / 320)
      painting.velY *= decay
      painting.velX *= decay
      if (Math.abs(painting.rotY) >= painting.maxY) painting.velY = 0
      if (Math.abs(painting.rotX) >= painting.maxX) painting.velX = 0
      clampRotation(painting)
      if (Math.abs(painting.velY) < 0.003 && Math.abs(painting.velX) < 0.003) {
        painting.velY = painting.velX = 0
        scheduleSpring(painting)
      } else moving = true
    } else if (painting.springing) {
      // Critically damped spring back to the front view.
      const omega = painting.zoom > 1 ? 0.012 : 0.006
      painting.springVY += (-omega * omega * painting.rotY - 2 * omega * painting.springVY) * dt
      painting.springVX += (-omega * omega * painting.rotX - 2 * omega * painting.springVX) * dt
      painting.rotY += painting.springVY * dt
      painting.rotX += painting.springVX * dt
      if (Math.abs(painting.rotY) < 0.05 && Math.abs(painting.rotX) < 0.05 && Math.abs(painting.springVY) < 0.001 && Math.abs(painting.springVX) < 0.001) {
        painting.rotY = painting.rotX = painting.springVY = painting.springVX = 0
        painting.springing = false
      } else moving = true
    }
  }
  if (painting.autoStart >= 0) {
    const t = (now - painting.autoStart) / AUTO_TURN.duration
    if (t >= 1) {
      painting.autoY = 0
      painting.autoStart = -1
    } else {
      painting.autoY = (painting.index % 2 ? -1 : 1) * AUTO_TURN.angle * (1 - Math.cos(2 * Math.PI * t)) / 2
      moving = true
    }
  }
  if (painting.zoom !== painting.zoomTo || painting.cx !== painting.cxTo || painting.cy !== painting.cyTo) {
    const k = reduced() ? 1 : 1 - Math.exp(-dt / 90)
    painting.zoom += (painting.zoomTo - painting.zoom) * k
    painting.cx += (painting.cxTo - painting.cx) * k
    painting.cy += (painting.cyTo - painting.cy) * k
    if (Math.abs(painting.zoom - painting.zoomTo) < 0.002 && Math.abs(painting.cx - painting.cxTo) < 0.0005 && Math.abs(painting.cy - painting.cyTo) < 0.0005) {
      painting.zoom = painting.zoomTo
      painting.cx = painting.cxTo
      painting.cy = painting.cyTo
      if (painting.zoom === 1) painting.el.classList.remove('is-zoomed')
    } else moving = true
  }
  return moving
}

function clampRotation(painting: Painting) {
  painting.rotY = clamp(painting.rotY, -painting.maxY, painting.maxY)
  painting.rotX = clamp(painting.rotX, -painting.maxX, painting.maxX)
}

function stopMotion(painting: Painting) {
  window.clearTimeout(painting.springTimer)
  painting.springing = false
  painting.velX = painting.velY = 0
  painting.springVY = painting.springVX = 0
  if (painting.autoStart >= 0) {
    painting.autoStart = -1
    painting.autoY = 0
  }
}

/** After two seconds without a touch the painting turns back to the front. */
function scheduleSpring(painting: Painting) {
  window.clearTimeout(painting.springTimer)
  if (!painting.rotX && !painting.rotY) return
  painting.springTimer = window.setTimeout(() => {
    if (painting.held) return
    painting.springing = true
    animate(painting)
  }, SPRING_DELAY)
}

function hideHint() {
  hint?.classList.add('is-gone')
}

// ---------- Text under the painting ----------
function setOpen(painting: Painting, open: boolean, animated = true) {
  if (open === painting.el.classList.contains('is-open')) return
  painting.stage.setAttribute('aria-expanded', String(open))
  if (open) {
    painting.inner.removeAttribute('hidden')
    if (animated) void painting.text.offsetHeight
    painting.el.classList.add('is-open')
    reachGoal('canvas_open_text', { painting: painting.slug })
  } else {
    painting.el.classList.remove('is-open')
    if (untilFound && (reduced() || !animated)) painting.inner.setAttribute('hidden', 'until-found')
  }
}

// ---------- Zoom ----------
function clampCentre(painting: Painting, zoom: number) {
  const limit = 0.5 * (1 - 1 / zoom)
  painting.cxTo = clamp(painting.cxTo, -limit, limit)
  painting.cyTo = clamp(painting.cyTo, -limit, limit)
}

function zoomIn(painting: Painting, clientX: number, clientY: number) {
  const rect = painting.stage.getBoundingClientRect()
  const sx = (clientX - rect.left) / rect.width - 0.5
  const sy = (clientY - rect.top) / rect.height - 0.5
  stopMotion(painting)
  painting.springing = true
  painting.zoomTo = MAX_ZOOM
  // The tapped point stays under the finger.
  painting.cxTo = sx * (1 - 1 / MAX_ZOOM)
  painting.cyTo = sy * (1 - 1 / MAX_ZOOM)
  clampCentre(painting, MAX_ZOOM)
  painting.el.classList.add('is-zoomed')
  view3d?.sharpen(painting)
  animate(painting)
}

function zoomOut(painting: Painting) {
  painting.zoomTo = 1
  painting.cxTo = painting.cyTo = 0
  animate(painting)
}

// ---------- Pointer and keyboard ----------
interface Gesture {
  id: number
  touch: boolean
  x0: number
  y0: number
  width: number
  height: number
  rotY0: number
  rotX0: number
  cx0: number
  cy0: number
  mode: 'pending' | 'drag' | 'scroll'
  lastT: number
  lastY: number
  lastX: number
  vY: number
  vX: number
}
interface Pinch { distance: number; zoom: number; px: number; py: number; rect: DOMRect }

function bind(painting: Painting) {
  const { stage } = painting
  const pointers = new Map<number, { x: number; y: number }>()
  let gesture: Gesture | null = null
  let pinch: Pinch | null = null

  const pinchState = (): [number, number, number] => {
    const [a, b] = [...pointers.values()]
    return [Math.hypot(a.x - b.x, a.y - b.y), (a.x + b.x) / 2, (a.y + b.y) / 2]
  }

  stage.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    painting.suppressClick = false
    hideHint()
    if (pointers.size === 2 && event.pointerType === 'touch') {
      // Two fingers: pinch to zoom, the point between them stays in place.
      const rect = stage.getBoundingClientRect()
      const [distance, mx, my] = pinchState()
      pinch = {
        distance, zoom: painting.zoom, rect,
        px: painting.cx + ((mx - rect.left) / rect.width - 0.5) / painting.zoom,
        py: painting.cy + ((my - rect.top) / rect.height - 0.5) / painting.zoom,
      }
      gesture = null
      painting.held = true
      stopMotion(painting)
      painting.springing = true
      for (const id of pointers.keys()) if (!stage.hasPointerCapture(id)) stage.setPointerCapture(id)
      return
    }
    if (pointers.size > 1) return
    const rect = stage.getBoundingClientRect()
    gesture = {
      id: event.pointerId, touch: event.pointerType !== 'mouse', x0: event.clientX, y0: event.clientY,
      width: rect.width, height: rect.height, rotY0: painting.rotY, rotX0: painting.rotX, cx0: painting.cxTo, cy0: painting.cyTo,
      mode: 'pending', lastT: event.timeStamp, lastY: painting.rotY, lastX: painting.rotX, vY: 0, vX: 0,
    }
  })

  stage.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pinch && pointers.size >= 2) {
      const [distance, mx, my] = pinchState()
      const zoom = clamp(pinch.zoom * distance / pinch.distance, 1, MAX_ZOOM)
      painting.zoom = painting.zoomTo = zoom
      painting.cx = painting.cxTo = pinch.px - ((mx - pinch.rect.left) / pinch.rect.width - 0.5) / zoom
      painting.cy = painting.cyTo = pinch.py - ((my - pinch.rect.top) / pinch.rect.height - 0.5) / zoom
      clampCentre(painting, zoom)
      painting.cx = painting.cxTo
      painting.cy = painting.cyTo
      if (zoom > 1.02 && !painting.el.classList.contains('is-zoomed')) {
        painting.el.classList.add('is-zoomed')
        view3d?.sharpen(painting)
      }
      invalidate(painting)
      return
    }
    const g = gesture
    if (!g || g.id !== event.pointerId) return
    const dx = event.clientX - g.x0
    const dy = event.clientY - g.y0
    if (g.mode === 'pending') {
      if (Math.hypot(dx, dy) < (g.touch ? 8 : 4)) return
      // A mostly vertical start scrolls the page (touch-action: pan-y); a horizontal one turns the painting.
      if (g.touch && Math.abs(dy) > Math.abs(dx) && painting.zoom === 1) { g.mode = 'scroll'; return }
      g.mode = 'drag'
      painting.held = true
      painting.suppressClick = true
      stopMotion(painting)
      stage.setPointerCapture(g.id)
      stage.classList.add('is-dragging')
    }
    if (g.mode !== 'drag') return
    if (painting.zoom > 1) {
      painting.cxTo = g.cx0 - dx / g.width / painting.zoom
      painting.cyTo = g.cy0 - dy / g.height / painting.zoom
      clampCentre(painting, painting.zoomTo)
      painting.cx = painting.cxTo
      painting.cy = painting.cyTo
    } else {
      painting.rotY = g.rotY0 + dx / g.width * (painting.gl ? 200 : 40)
      painting.rotX = g.rotX0 - dy / g.height * (painting.gl ? 60 : 30)
      clampRotation(painting)
      const elapsed = event.timeStamp - g.lastT
      if (elapsed > 0) {
        g.vY = 0.75 * ((painting.rotY - g.lastY) / elapsed) + 0.25 * g.vY
        g.vX = 0.75 * ((painting.rotX - g.lastX) / elapsed) + 0.25 * g.vX
        g.lastT = event.timeStamp
        g.lastY = painting.rotY
        g.lastX = painting.rotX
      }
    }
    invalidate(painting)
  })

  const end = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return
    if (pinch) {
      if (pointers.size < 2) {
        pinch = null
        painting.held = false
        if (painting.zoom < 1.08) zoomOut(painting)
        else animate(painting)
      }
      return
    }
    const g = gesture
    if (!g || g.id !== event.pointerId) return
    gesture = null
    stage.classList.remove('is-dragging')
    if (g.mode !== 'drag') return
    painting.held = false
    // Inertia only if the finger was still moving when it lifted.
    const recent = event.timeStamp - g.lastT < 80
    if (!reduced() && painting.zoom === 1 && recent && event.type === 'pointerup') {
      painting.velY = clamp(g.vY, -2, 2)
      painting.velX = clamp(g.vX, -1, 1)
    }
    if (painting.velX || painting.velY) animate(painting)
    else scheduleSpring(painting)
  }
  stage.addEventListener('pointerup', end)
  stage.addEventListener('pointercancel', end)
  stage.addEventListener('lostpointercapture', event => { if (gesture?.id === event.pointerId) end(event) })

  stage.addEventListener('click', event => {
    if (painting.suppressClick) { painting.suppressClick = false; return }
    // Keyboard (Enter, Space): no double-tap to wait for.
    if (event.detail === 0) { setOpen(painting, !painting.el.classList.contains('is-open')); return }
    if (painting.tapTimer) {
      window.clearTimeout(painting.tapTimer)
      painting.tapTimer = 0
      if (painting.zoomTo > 1) zoomOut(painting)
      else zoomIn(painting, event.clientX, event.clientY)
      return
    }
    painting.tapTimer = window.setTimeout(() => {
      painting.tapTimer = 0
      if (painting.zoomTo === 1) setOpen(painting, !painting.el.classList.contains('is-open'))
    }, 260)
  })
  // Desktop browsers send dblclick too; the click pair above already handled it.
  stage.addEventListener('dblclick', event => event.preventDefault())

  stage.addEventListener('keydown', event => {
    const turns: Record<string, [number, number]> = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }
    if (event.key === 'Escape' && painting.zoomTo > 1) { zoomOut(painting); return }
    const turn = turns[event.key]
    if (!turn || event.altKey || event.metaKey || event.ctrlKey) return
    event.preventDefault()
    hideHint()
    stopMotion(painting)
    painting.rotY += turn[0]
    painting.rotX += turn[1]
    clampRotation(painting)
    invalidate(painting)
    scheduleSpring(painting)
  })

  if (untilFound) painting.inner.addEventListener('beforematch', () => setOpen(painting, true, false))
  painting.text.addEventListener('transitionend', event => {
    if (event.target === painting.text && untilFound && !painting.el.classList.contains('is-open')) painting.inner.setAttribute('hidden', 'until-found')
  })
}

// ---------- Visibility: textures one screen ahead, the hint turn once in view ----------
function maybeAutoTurn(painting: Painting) {
  if (painting.autoDone || !painting.visible || reduced() || painting.held) return
  if (view3d && !painting.gl) return
  painting.autoDone = true
  painting.autoStart = performance.now()
  animate(painting)
}

// Paintings switch to WebGL one per frame: each one uploads a texture, and a phone should not stall on several.
let queue = Promise.resolve()
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

function activate(painting: Painting) {
  queue = queue.then(() => activateNow(painting)).then(nextFrame)
}

async function activateNow(painting: Painting) {
  if (!view3d || painting.gl || !painting.near) return
  if (!await view3d.prepare(painting) || !painting.near || painting.gl) return
  painting.gl = true
  painting.body.style.transform = ''
  painting.el.classList.add('is-gl')
  invalidate(painting)
  maybeAutoTurn(painting)
}

function deactivate(painting: Painting) {
  if (!painting.gl) return
  painting.gl = false
  painting.el.classList.remove('is-gl')
  view3d?.release(painting)
  clampRotation(painting)
}

const nearObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const painting = paintings.find(item => item.el === entry.target)!
    painting.near = entry.isIntersecting
    if (painting.near) {
      painting.image.loading = 'eager'
      activate(painting)
    }
  }
}, { rootMargin: '100% 0px' })
const farObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) continue
    deactivate(paintings.find(item => item.el === entry.target)!)
  }
}, { rootMargin: '250% 0px' })
const visibleObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const painting = paintings.find(item => item.stage === entry.target)!
    painting.visible = entry.isIntersecting
    maybeAutoTurn(painting)
  }
}, { threshold: 0.6 })
const resizeObserver = new ResizeObserver(entries => {
  for (const entry of entries) {
    const painting = paintings.find(item => item.stage === entry.target)!
    if (painting.gl) invalidate(painting)
  }
})

for (const painting of paintings) {
  painting.stage.setAttribute('aria-expanded', 'false')
  if (untilFound) painting.inner.setAttribute('hidden', 'until-found')
  bind(painting)
  nearObserver.observe(painting.el)
  farObserver.observe(painting.el)
  visibleObserver.observe(painting.stage)
  resizeObserver.observe(painting.stage)
}

// ---------- WebGL (three.js), unless ?no3d=1 or WebGL is missing ----------
async function start3d() {
  if (new URLSearchParams(window.location.search).has('no3d') || !('WebGLRenderingContext' in window)) return
  const { createView } = await import('./scene')
  view3d = await createView({
    lost() {
      // Context lost: every painting goes back to its <img> until the context returns.
      for (const painting of paintings) {
        painting.gl = false
        painting.el.classList.remove('is-gl')
        clampRotation(painting)
        draw(painting)
      }
    },
    restored() {
      for (const painting of paintings) if (painting.near) activate(painting)
    },
  })
  if (!view3d) return
  for (const painting of paintings) if (painting.near) activate(painting)
}

document.querySelector<HTMLAnchorElement>('.cv-links__buy')?.addEventListener('click', event => {
  const link = event.currentTarget as HTMLAnchorElement
  reachGoal('buy_click', { performance: link.dataset.performance ?? '', date: link.dataset.date ?? '' })
})

startBackground(reduced)
startCounters()
// three.js after the page has loaded and the browser is idle: the text and the images come first.
const later = () => window.setTimeout(() => typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(() => void start3d(), { timeout: 2000 }) : void start3d(), 800)
if (document.readyState === 'complete') later()
else window.addEventListener('load', later, { once: true })
