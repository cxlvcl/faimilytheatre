import { useLayoutEffect, useRef } from 'react'
import { LoadError } from '../components/LoadError'
import { SmoothLink } from '../components/SmoothLink'
import { usePublicResource } from '../hooks/usePublicResource'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { setupRepertoireMotion } from '../lib/repertoireMotion'
import type { PerformanceSummary } from '../types'

export default function RepertoirePage() {
  const root = useRef<HTMLDivElement>(null)
  const { data: performances = [], status, retry: load } = usePublicResource<PerformanceSummary[]>('/public/performances')

  useLayoutEffect(() => {
    if (status !== 'ready' || !root.current || performances.length === 0) return
    return setupRepertoireMotion(root.current)
  }, [performances, status])

  if (status === 'error') {
    return (
      <section className="simple-page simple-page--dark">
        <LoadError retry={load} />
      </section>
    )
  }

  if (status === 'loading') return <div className="page-wash page-wash--dark" aria-hidden="true" />

  if (performances.length === 0) {
    return (
      <section className="simple-page simple-page--dark">
        <h1>Репертуар</h1>
      </section>
    )
  }

  return (
    <div ref={root} className="repertoire-page">
      <div className="listing-heading"><Breadcrumbs items={[{ name: 'Главная', path: '/' }]} /><h1>Репертуар</h1></div>
      {performances.map((performance, index) => (
        <article className="repertoire-scene" id={`show-${performance.slug}`} key={performance.id}>
          <img
            className="repertoire-scene__background"
            src={performance.cover_image}
            alt=""
            aria-hidden="true"
            loading={index < 2 ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority="low"
          />
          <div className="repertoire-scene__shade" />
          <div className="repertoire-scene__content">
            <SmoothLink
              className="repertoire-scene__cover"
              to={`/repertoire/${performance.slug}`}
              state={{ fromRepertoire: true }}
              aria-label={`Открыть спектакль «${performance.title}»`}
            >
              <img src={performance.cover_image} alt="" width="750" height="1000" loading={index < 2 ? 'eager' : 'lazy'} decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} />
            </SmoothLink>
            <div className="repertoire-scene__copy">
              <h2><SmoothLink to={`/repertoire/${performance.slug}`}>{performance.title}</SmoothLink></h2>
              {performance.is_premiere && <p className="premiere">Премьера</p>}
              <p>{performance.short_description}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
