import { useLayoutEffect, useRef, useState } from 'react'
import { LoadError } from '../components/LoadError'
import { EventDate } from '../components/EventDate'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { PosterLightbox } from '../components/PosterLightbox'
import { SmoothLink } from '../components/SmoothLink'
import { usePublicResource } from '../hooks/usePublicResource'
import { publicApi } from '../lib/api'
import { setupRepertoireMotion } from '../lib/repertoireMotion'
import type { EventItem } from '../types'

export default function AfishaPage() {
  const root = useRef<HTMLDivElement>(null)
  const [opened, setOpened] = useState<EventItem | null>(null)
  const { data: events = [], status, retry } = usePublicResource<EventItem[]>('/public/events')
  useLayoutEffect(() => {
    if (!root.current || !events.length) return
    return setupRepertoireMotion(root.current, 'event')
  }, [events])
  if (status === 'error') return <section className="simple-page simple-page--dark"><LoadError retry={retry} /></section>
  if (status === 'loading') return <div className="page-wash page-wash--dark" aria-hidden="true" />
  if (!events.length) return <section className="simple-page simple-page--dark afisha-empty"><Breadcrumbs items={[{ name: 'Главная', path: '/' }, { name: 'Афиша' }]} /><h1>Афиша</h1><p>Новые даты скоро появятся</p></section>
  return <div ref={root} className="afisha-page">
    <div className="listing-heading"><Breadcrumbs items={[{ name: 'Главная', path: '/' }]} /><h1>Афиша</h1></div>
    {events.map((event, index) => <article className="event-scene" id={`event-${event.id}`} key={event.id}>
      <img className="event-scene__background" src={event.poster_image} alt="" aria-hidden="true" loading={index < 2 ? 'eager' : 'lazy'} decoding="async" fetchPriority={index === 0 ? 'auto' : 'low'} />
      <div className="event-scene__shade" />
      <div className="event-scene__content">
        <p className="event-scene__date"><EventDate date={event.event_date} time={event.event_time} /></p>
        <button type="button" className="event-scene__poster-link" onClick={() => setOpened(event)} aria-label={`Открыть афишу «${event.performance.title}» крупно`}>
          <img className="event-scene__poster" src={event.poster_image} alt={`Афиша спектакля «${event.performance.title}»`} width="750" height="1000" loading={index < 2 ? 'eager' : 'lazy'} decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} />
        </button>
        <div className="event-scene__copy">
          <h2><SmoothLink to={`/repertoire/${event.performance.slug}`}>{event.performance.title}</SmoothLink></h2>
          {event.performance.is_premiere && <p className="premiere">Премьера</p>}
          <p className="event-scene__venue">{event.venue}</p>
          <a className="event-scene__buy" href={event.ticket_url} target="_blank" rel="noopener noreferrer" onClick={() => publicApi.ticketClick(event.id)}>Купить билет</a>
        </div>
      </div>
    </article>)}
    {opened && <PosterLightbox src={opened.poster_image} alt={`Афиша спектакля «${opened.performance.title}»`} onClose={() => setOpened(null)} />}
  </div>
}
