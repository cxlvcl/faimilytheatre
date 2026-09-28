import { useRef, useState } from 'react'
import { LoadError } from '../components/LoadError'
import { RestrictedMarkdown } from '../components/RestrictedMarkdown'
import { usePublicResource } from '../hooks/usePublicResource'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { useReveal } from '../hooks/useReveal'
import type { FaqItem } from '../types'

export default function FaqPage() {
  const root = useRef<HTMLElement>(null)
  const { data: items = [], status, retry: load } = usePublicResource<FaqItem[]>('/public/faq')
  const [openId, setOpenId] = useState<number | null>(null)
  useReveal(root, '.faq-item', status === 'ready')

  if (status === 'error') {
    return (
      <section className="simple-page">
        <LoadError retry={load} />
      </section>
    )
  }
  if (status === 'loading') return <div className="page-wash" aria-hidden="true" />

  return (
    <section ref={root} className="faq-page">
      <Breadcrumbs items={[{ name: 'Главная', path: '/' }, { name: 'FAQ' }]} />
      <h1>FAQ</h1>
      <div className="faq-list">
        {items.map((item) => {
          const expanded = openId === item.id
          return (
            <article className={`faq-item ${expanded ? 'is-open' : ''}`} key={item.id}>
              <h2>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`faq-answer-${item.id}`}
                  onClick={() => setOpenId(expanded ? null : item.id)}
                >
                  <span>{item.question}</span>
                  <span className="faq-item__symbol" aria-hidden="true">
                    {expanded ? '−' : '+'}
                  </span>
                </button>
              </h2>
              <div className="faq-item__answer-grid" id={`faq-answer-${item.id}`} aria-hidden={!expanded}>
                <div>
                  <RestrictedMarkdown value={item.answer} className="faq-item__answer" />
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
