import { useCallback, useEffect, useRef, useState } from 'react'
import { LoadError } from '../components/LoadError'
import { RestrictedMarkdown } from '../components/RestrictedMarkdown'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useReveal } from '../hooks/useReveal'
import { publicApi } from '../lib/api'
import type { FaqItem } from '../types'

export default function FaqPage() {
  const root = useRef<HTMLElement>(null)
  const [items, setItems] = useState<FaqItem[]>([])
  const [openId, setOpenId] = useState<number | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  useDocumentTitle('FAQ')
  useReveal(root, '.faq-item', status)

  const load = useCallback(() => {
    setStatus('loading')
    publicApi
      .faq()
      .then((faq) => {
        setItems(faq)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])
  useEffect(load, [load])

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
