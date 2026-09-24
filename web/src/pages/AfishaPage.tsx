import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { LoadError } from '../components/LoadError'
import { EventDate } from '../components/EventDate'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { publicApi } from '../lib/api'
import type { EventItem } from '../types'

gsap.registerPlugin(ScrollTrigger)

export default function AfishaPage() {
  const root = useRef<HTMLDivElement>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  useDocumentTitle('Афиша')

  const load = useCallback(() => {
    setStatus('loading')
    publicApi
      .events()
      .then((items) => {
        setEvents(items)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])
  useEffect(load, [load])

  useLayoutEffect(() => {
    if (!root.current || events.length === 0) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.event-scene').forEach((scene) => {
        gsap.fromTo(
          scene.querySelector('.event-scene__content'),
          { autoAlpha: 0, y: reduce ? 0 : 30, filter: reduce ? 'blur(0px)' : 'blur(14px)' },
          {
            autoAlpha: 1,
            y: 0,
            filter: 'blur(0px)',
            scrollTrigger: { trigger: scene, start: 'top 75%', end: 'top 36%', scrub: reduce ? false : 0.45 },
          },
        )
      })
    }, root)
    return () => context.revert()
  }, [events])

  if (status === 'error') {
    return (
      <section className="simple-page simple-page--dark">
        <LoadError retry={load} />
      </section>
    )
  }
  if (status === 'loading') return <div className="page-wash page-wash--dark" aria-hidden="true" />
  if (events.length === 0) {
    return (
      <section className="simple-page simple-page--dark afisha-empty">
        <h1>Новые даты скоро появятся</h1>
      </section>
    )
  }

  return (
    <div ref={root} className="afisha-page">
      {events.map((event) => (
        <article className="event-scene" key={event.id}>
          <img className="event-scene__background" src={event.poster_image} alt="" aria-hidden="true" />
          <div className="event-scene__shade" />
          <div className="event-scene__content">
            <p className="event-scene__date"><EventDate date={event.event_date} time={event.event_time} /></p>
            <img className="event-scene__poster" src={event.poster_image} alt="" loading="lazy" />
            <div className="event-scene__copy">
              <h1>{event.performance.title}</h1>
              {event.performance.is_premiere && <p className="premiere">Премьера</p>}
              <p className="event-scene__venue">{event.venue}</p>
              <a
                className="event-scene__buy"
                href={event.ticket_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => publicApi.ticketClick(event.id)}
              >
                Купить билет
              </a>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
