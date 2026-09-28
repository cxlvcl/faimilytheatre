import { useEffect, useRef } from 'react'
import '../styles/musicians.css'

const portraits = Array.from({ length: 10 }, (_, index) => index + 1)
export function MusiciansStrip() {
  const viewport = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const movement = useRef({ offset: 0, width: 0, dragging: false, x: 0, hover: false, focus: false, idle: 0 })
  const draw = () => {
    const state = movement.current
    if (state.width > 0) state.offset = ((state.offset % state.width) + state.width) % state.width
    if (track.current) track.current.style.transform = `translate3d(${-state.offset}px,0,0)`
  }
  useEffect(() => {
    const element = viewport.current
    const strip = track.current
    if (!element || !strip) return
    const state = movement.current
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    let visible = false
    let frame = 0
    let previous = 0
    const resize = new ResizeObserver(() => {
      const first = strip.children[0] as HTMLElement
      const repeat = strip.children[10] as HTMLElement
      state.width = repeat.offsetLeft - first.offsetLeft
      draw()
    })
    resize.observe(strip)
    const wake = () => {
      cancelAnimationFrame(frame)
      previous = 0
      frame = visible && !document.hidden && !media.matches ? requestAnimationFrame(animate) : 0
    }
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake() })
    intersection.observe(element)
    const animate = (now: number) => {
      if (!visible || document.hidden || media.matches) { frame = 0; previous = 0; return }
      if (previous && visible && !document.hidden && !media.matches && !state.hover && !state.focus && !state.dragging && now > state.idle) {
        state.offset += Math.min(now - previous, 40) / 1000 * (innerWidth < 720 ? 4 : 6)
        draw()
      }
      previous = now
      frame = requestAnimationFrame(animate)
    }
    document.addEventListener('visibilitychange', wake)
    media.addEventListener('change', wake)
    return () => { cancelAnimationFrame(frame); resize.disconnect(); intersection.disconnect(); document.removeEventListener('visibilitychange', wake); media.removeEventListener('change', wake) }
  }, [])
  const release = () => { movement.current.dragging = false; movement.current.idle = performance.now() + 3000 }
  return (
    <div ref={viewport} className="musicians-strip" tabIndex={0} role="region" aria-label="Директор и музыканты. Листайте в обе стороны или используйте стрелки клавиатуры."
      onPointerEnter={event => { if (event.pointerType === 'mouse') movement.current.hover = true }}
      onPointerLeave={() => { movement.current.hover = false }}
      onFocus={() => { movement.current.focus = true }} onBlur={() => { movement.current.focus = false }}
      onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); movement.current.offset += (event.key === 'ArrowRight' ? 1 : -1) * (viewport.current?.clientWidth ?? 320) * 0.65; draw() } }}
      onPointerDown={event => { movement.current.dragging = true; movement.current.x = event.clientX; event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={event => { if (!movement.current.dragging) return; movement.current.offset -= event.clientX - movement.current.x; movement.current.x = event.clientX; draw() }}
      onPointerUp={event => { release(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); if (event.pointerType !== 'mouse') event.currentTarget.blur() }}
      onPointerCancel={release} onLostPointerCapture={release}>
      <div ref={track} className="musicians-strip__track">
        {[...portraits, ...portraits].map((portrait, index) => (
          <figure className="musicians-strip__portrait" key={index} aria-hidden={index >= 10}>
            <img src={`/media/musicians/${portrait}.webp`} alt={index < 10 ? `Участник Театра Музыки и Песка ${portrait}` : ''} width="820" height="1230" loading="lazy" draggable={false} />
          </figure>
        ))}
      </div>
    </div>
  )
}
