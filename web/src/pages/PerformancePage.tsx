import { Fragment, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { useLocation, useParams } from 'react-router-dom'
import { useSmoothNavigation } from '../components/NavigationContext'
import { LoadError } from '../components/LoadError'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { EventDate } from '../components/EventDate'
import { usePublicResource } from '../hooks/usePublicResource'
import { publicApi } from '../lib/api'
import { inlineMarkdown, paperLayout } from '../lib/inlineMarkdown'
import type { EventItem, Performance } from '../types'

/** Newspaper-style page: the text with the cover and a second photo set into it, then the upcoming shows. */
export default function PerformancePage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const { goBack } = useSmoothNavigation()
  const root = useRef<HTMLElement>(null)
  const { data: performance, status, retry } = usePublicResource<Performance>(`/public/performances/${encodeURIComponent(slug)}`)
  const { data: events = [], status: eventsStatus, retry: retryEvents } = usePublicResource<EventItem[]>('/public/events')
  useLayoutEffect(() => {
    if (!root.current || status !== 'ready' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const context = gsap.context(() => {
      gsap.fromTo('.performance-paper__photo', { opacity: 0, filter: 'blur(5px)' }, { opacity: 1, filter: 'blur(0px)', duration: .75, stagger: .15, clearProps: 'opacity,filter' })
    }, root)
    return () => context.revert()
  }, [status])
  if (status === 'not-found') return <section className="simple-page"><h1>Спектакль не найден</h1></section>
  if (status === 'error') return <section className="simple-page"><LoadError retry={retry} /></section>
  if (!performance || status === 'loading') return <div className="page-wash" aria-hidden="true" />
  const upcoming = events.filter(event => event.performance.slug === slug)
  const { paragraphs, photoAt } = paperLayout(performance.description, performance.title)
  const returnTo = location.state?.returnTo as { pathname?: string } | undefined
  // From the list: history back restores the exact position; otherwise open the list at this performance.
  const backToList = () => goBack('/repertoire', { state: { focus: `show-${slug}` } }, Boolean(returnTo))
  const secondPhoto = performance.hero_image && <figure className="performance-paper__photo performance-paper__photo--second">
    <img src={performance.hero_image} alt={`Сцена из спектакля «${performance.title}»`} loading="lazy" decoding="async" />
  </figure>
  return <article ref={root} className="performance-paper">
    <header className="performance-paper__head">
      <Breadcrumbs items={[{ name: 'Главная', path: '/' }, { name: 'Репертуар', path: '/repertoire' }, { name: performance.title }]} />
      <h1>{performance.title}</h1>
      {performance.is_premiere && <p className="premiere premiere--dark">Премьера</p>}
    </header>
    <div className="performance-paper__text">
      <figure className="performance-paper__photo performance-paper__photo--cover">
        <img src={performance.cover_image} alt={`Постер спектакля «${performance.title}»`} width="750" height="1000" fetchPriority="high" decoding="async" />
      </figure>
      {paragraphs.map((paragraph, index) => <Fragment key={`${index}-${paragraph.slice(0, 16)}`}>
        {index === photoAt && secondPhoto}
        <p>{inlineMarkdown(paragraph.replace(/\n/g, ' '))}</p>
      </Fragment>)}
      {photoAt >= paragraphs.length && secondPhoto}
    </div>
    <section className="performance-paper__events" aria-labelledby="performance-events">
      <h2 id="performance-events">Ближайшие показы</h2>
      {eventsStatus === 'error' ? <LoadError retry={retryEvents} /> : eventsStatus === 'loading' ? <p>Загружаем афишу…</p> : upcoming.length ? <ul>{upcoming.map(event => <li key={event.id}><EventDate date={event.event_date} time={event.event_time} /> — {event.venue}. <a href={event.ticket_url} target="_blank" rel="noopener noreferrer" onClick={() => publicApi.ticketClick(event.id)}>Купить билет</a></li>)}</ul> : <p>Новые даты скоро появятся.</p>}
    </section>
    <button type="button" className="performance-paper__back" onClick={backToList}>
      {returnTo?.pathname === '/afisha' ? 'Назад к афише' : 'Назад к списку спектаклей'}
    </button>
  </article>
}
