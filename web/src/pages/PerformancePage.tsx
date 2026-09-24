import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useParams } from 'react-router-dom'
import { LoadError } from '../components/LoadError'
import { RestrictedMarkdown } from '../components/RestrictedMarkdown'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { ApiError, publicApi } from '../lib/api'
import type { Performance } from '../types'

export default function PerformancePage() {
  const { slug = '' } = useParams()
  const root = useRef<HTMLElement>(null)
  const [performance, setPerformance] = useState<Performance | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'not-found'>('loading')
  useDocumentTitle(performance?.title ?? 'Спектакль')

  const load = useCallback(() => {
    setStatus('loading')
    publicApi
      .performance(slug)
      .then((item) => {
        setPerformance(item)
        setStatus('ready')
      })
      .catch((error: unknown) => {
        setStatus(error instanceof ApiError && error.code === 'not_found' ? 'not-found' : 'error')
      })
  }, [slug])

  useEffect(load, [load])

  useLayoutEffect(() => {
    if (!root.current || status !== 'ready') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const context = gsap.context(() => {
      gsap
        .timeline({ defaults: { ease: 'power2.out' } })
        .fromTo('.performance-detail__hero-image', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8 })
        .fromTo(
          '.performance-detail__cover',
          { autoAlpha: 0, filter: reduce ? 'blur(0px)' : 'blur(20px) brightness(1.7)' },
          { autoAlpha: 1, filter: 'blur(0px) brightness(1)', duration: reduce ? 0.45 : 1.35 },
          '-=0.1',
        )
        .fromTo(
          '.performance-detail__copy > *',
          { autoAlpha: 0, y: reduce ? 0 : 24, filter: reduce ? 'blur(0px)' : 'blur(10px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', stagger: 0.13, duration: 0.8 },
          '-=0.55',
        )
    }, root)
    return () => context.revert()
  }, [status])

  if (status === 'not-found') {
    return (
      <section className="simple-page">
        <h1>Спектакль не найден</h1>
      </section>
    )
  }
  if (status === 'error') {
    return (
      <section className="simple-page">
        <LoadError retry={load} />
      </section>
    )
  }
  if (!performance || status === 'loading') return <div className="page-wash" aria-hidden="true" />

  const focus = {
    '--focus-desktop': `${performance.hero_focus_desktop_x}% ${performance.hero_focus_desktop_y}%`,
    '--focus-mobile': `${performance.hero_focus_mobile_x}% ${performance.hero_focus_mobile_y}%`,
  } as React.CSSProperties

  return (
    <article ref={root} className="performance-detail" style={focus}>
      <div className="performance-detail__hero">
        <img className="performance-detail__hero-image" src={performance.hero_image} alt="" />
        <div className="performance-detail__hero-shade" />
      </div>
      <div className="performance-detail__body">
        <img className="performance-detail__cover" src={performance.cover_image} alt="" />
        <div className="performance-detail__copy">
          <h1>{performance.title}</h1>
          {performance.is_premiere && <p className="premiere premiere--dark">Премьера</p>}
          <RestrictedMarkdown value={performance.description} className="performance-detail__description" />
        </div>
      </div>
    </article>
  )
}

