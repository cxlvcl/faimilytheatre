import { useRef } from 'react'
import { EventDate } from './EventDate'
import { SmoothLink } from './SmoothLink'
import { usePublicResource } from '../hooks/usePublicResource'
import { useReveal } from '../hooks/useReveal'
import { publicApi } from '../lib/api'
import type { EventItem } from '../types'

/** Short descriptions often start with the title on its own line; the card already shows it as a heading. */
function description({ title, short_description }: EventItem['performance']) {
  const lines = short_description.split('\n').map(line => line.trim()).filter(Boolean)
  if (lines[0]?.toLocaleLowerCase('ru') === title.trim().toLocaleLowerCase('ru')) lines.shift()
  return lines.join('\n')
}

/** The two nearest dates from the afisha; hidden while loading, on error and when nothing is scheduled. */
export function UpcomingDates() {
  const root = useRef<HTMLElement>(null)
  const { data } = usePublicResource<EventItem[]>('/public/events')
  const events = data?.slice(0, 2) ?? []
  useReveal(root, '.upcoming__heading, .upcoming__event, .upcoming__all', events.length)
  if (!events.length) return null
  return <section ref={root} className="upcoming" aria-labelledby="upcoming-title">
    <h2 id="upcoming-title" className="upcoming__heading">Ближайшие даты</h2>
    <div className="upcoming__list">{events.map(event => {
      const url = `/repertoire/${event.performance.slug}`
      const text = description(event.performance)
      return <article className="upcoming__event" key={event.id}>
        <SmoothLink className="upcoming__poster" to={url} aria-label={`О спектакле «${event.performance.title}»`}>
          <img src={event.poster_image} alt={`Афиша спектакля «${event.performance.title}»`} width="750" height="1000" loading="lazy" decoding="async" />
        </SmoothLink>
        <div className="upcoming__copy">
          <p className="upcoming__date"><EventDate date={event.event_date} time={event.event_time} /></p>
          <h3><SmoothLink to={url}>{event.performance.title}</SmoothLink></h3>
          {event.performance.is_premiere && <p className="premiere">Премьера</p>}
          {text && <p className="upcoming__description">{text}</p>}
          <p className="upcoming__venue">{event.venue}</p>
          <a className="upcoming__buy" href={event.ticket_url} target="_blank" rel="noopener noreferrer" onClick={() => publicApi.ticketClick(event.id)}>Купить билет</a>
        </div>
      </article>
    })}</div>
    <SmoothLink className="upcoming__all" to="/afisha">Вся афиша</SmoothLink>
  </section>
}
