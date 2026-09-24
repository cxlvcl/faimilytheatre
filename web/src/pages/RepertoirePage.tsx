import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { LoadError } from '../components/LoadError'
import { SmoothLink } from '../components/SmoothLink'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { publicApi } from '../lib/api'
import { setupRepertoireMotion } from '../lib/repertoireMotion'
import type { PerformanceSummary } from '../types'

export default function RepertoirePage() {
  const root = useRef<HTMLDivElement>(null)
  const [performances, setPerformances] = useState<PerformanceSummary[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  useDocumentTitle('Репертуар')

  const load = useCallback(() => {
    setStatus('loading')
    publicApi
      .performances()
      .then((items) => {
        setPerformances(items)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  useEffect(load, [load])

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
      {performances.map((performance, index) => (
        <article className="repertoire-scene" key={performance.id}>
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
              <img src={performance.cover_image} alt="" loading={index < 2 ? 'eager' : 'lazy'} decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} />
            </SmoothLink>
            <div className="repertoire-scene__copy">
              <h1>{performance.title}</h1>
              {performance.is_premiere && <p className="premiere">Премьера</p>}
              <p>{performance.short_description}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}
