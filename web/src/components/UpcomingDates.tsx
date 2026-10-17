import { useRef, useState } from 'react'
import { EventDate } from './EventDate'
import { SmoothLink } from './SmoothLink'
import { usePublicResource } from '../hooks/usePublicResource'
import { useReveal } from '../hooks/useReveal'
import { BuyLink } from './BuyLink'
import { withoutTitleLine } from '../lib/titleLine'
import type { EventItem } from '../types'

/** Slider with the three nearest afisha dates; hidden while loading, on error and when nothing is scheduled. */
export function UpcomingDates() {
  const root = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const { data } = usePublicResource<EventItem[]>('/public/events')
  const events = data?.slice(0, 3) ?? []
  useReveal(root, '.upcoming__head, .upcoming__track, .upcoming__all', events.length)
  if (!events.length) return null
  const cards = () => Array.from(track.current?.children ?? []) as HTMLElement[]
  const show = (index: number) => {
    const card = cards()[index]
    if (card && track.current) track.current.scrollTo({ left: card.offsetLeft - track.current.offsetLeft, behavior: 'smooth' })
  }
  const sync = () => {
    const element = track.current
    if (!element) return
    const offsets = cards().map(card => Math.abs(card.offsetLeft - element.offsetLeft - element.scrollLeft))
    setCurrent(offsets.indexOf(Math.min(...offsets)))
  }
  return <section ref={root} className="upcoming" aria-labelledby="upcoming-title">
    <div className="upcoming__head">
      <h2 id="upcoming-title">Ближайшие даты</h2>
      {events.length > 1 && <div className="upcoming__controls">
        <button type="button" onClick={() => show(current - 1)} disabled={current === 0} aria-label="Предыдущая дата">←</button>
        <span aria-live="polite">{current + 1} / {events.length}</span>
        <button type="button" onClick={() => show(current + 1)} disabled={current === events.length - 1} aria-label="Следующая дата">→</button>
      </div>}
    </div>
    <div ref={track} className="upcoming__track" onScroll={sync}>{events.map(event => {
      const url = `/repertoire/${event.performance.slug}`
      const text = withoutTitleLine(event.performance.short_description, event.performance.title)
      return <article className="upcoming__event" key={event.id}>
        <SmoothLink className="upcoming__poster" to={url} aria-label={`О спектакле «${event.performance.title}»`}>
          <img src={event.poster_image} alt={event.poster_alt} width="750" height="1000" loading="lazy" decoding="async" />
        </SmoothLink>
        <div className="upcoming__copy">
          <p className="upcoming__date"><EventDate date={event.event_date} time={event.event_time} /></p>
          <h3><SmoothLink to={url}>{event.performance.title}</SmoothLink></h3>
          {event.performance.is_premiere && <p className="premiere">Премьера</p>}
          {text && <p className="upcoming__description">{text}</p>}
          <p className="upcoming__venue">{event.venue}</p>
          <BuyLink className="upcoming__buy" event={event} title={event.performance.title} />
        </div>
      </article>
    })}</div>
    <SmoothLink className="upcoming__all" to="/afisha">Вся афиша</SmoothLink>
  </section>
}
