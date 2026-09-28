import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { LoadError } from '../components/LoadError'
import { RestrictedMarkdown } from '../components/RestrictedMarkdown'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { EventDate } from '../components/EventDate'
import { usePublicResource } from '../hooks/usePublicResource'
import { publicApi } from '../lib/api'
import type { EventItem, Performance } from '../types'

export default function PerformancePage() {
  const { slug = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const root = useRef<HTMLElement>(null)
  const { data: performance, status, retry } = usePublicResource<Performance>(`/public/performances/${encodeURIComponent(slug)}`)
  const { data: events = [], status: eventsStatus, retry: retryEvents } = usePublicResource<EventItem[]>('/public/events')
  useLayoutEffect(() => {
    if (!root.current || status !== 'ready' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const context = gsap.context(() => {
      gsap.fromTo('.performance-detail__cover', { opacity: 0, filter: 'blur(5px)' }, { opacity: 1, filter: 'blur(0px)', duration: .75, clearProps: 'opacity,filter' })
    }, root)
    return () => context.revert()
  }, [status])
  if (status === 'not-found') return <section className="simple-page"><h1>Спектакль не найден</h1></section>
  if (status === 'error') return <section className="simple-page"><LoadError retry={retry} /></section>
  if (!performance || status === 'loading') return <div className="page-wash" aria-hidden="true" />
  const focus = { '--focus-desktop': `${performance.hero_focus_desktop_x}% ${performance.hero_focus_desktop_y}%`, '--focus-mobile': `${performance.hero_focus_mobile_x}% ${performance.hero_focus_mobile_y}%` } as React.CSSProperties
  const upcoming = events.filter(event => event.performance.slug === slug)
  return <article ref={root} className="performance-detail" style={focus}>
    <div className="performance-detail__hero"><img className="performance-detail__hero-image" src={performance.hero_image} alt={`Сцена из спектакля «${performance.title}»`} width="1600" height="900" fetchPriority="high" /><div className="performance-detail__hero-shade" /></div>
    <div className="performance-detail__body">
      <img className="performance-detail__cover" src={performance.cover_image} alt={`Постер спектакля «${performance.title}»`} width="750" height="1000" decoding="async" />
      <div className="performance-detail__copy">
        <Breadcrumbs items={[{ name: 'Главная', path: '/' }, { name: 'Репертуар', path: '/repertoire' }, { name: performance.title }]} />
        {location.state?.returnTo && <button className="return-to-list" onClick={() => navigate(-1)}>← Вернуться в {location.state.returnTo.pathname === '/afisha' ? 'афишу' : 'репертуар'}</button>}
        <h1>{performance.title}</h1>
        {performance.is_premiere && <p className="premiere premiere--dark">Премьера</p>}
        <RestrictedMarkdown value={performance.description} className="performance-detail__description" />
        <section className="performance-detail__events" aria-label="Ближайшие показы"><h2>Ближайшие показы</h2>
          {eventsStatus === 'error' ? <LoadError retry={retryEvents} /> : eventsStatus === 'loading' ? <p>Загружаем афишу…</p> : upcoming.length ? <ul>{upcoming.map(event => <li key={event.id}><EventDate date={event.event_date} time={event.event_time} /> — {event.venue}. <a href={event.ticket_url} target="_blank" rel="noopener noreferrer" onClick={() => publicApi.ticketClick(event.id)}>Купить билет</a></li>)}</ul> : <p>Новые даты скоро появятся.</p>}
        </section>
      </div>
    </div>
  </article>
}
