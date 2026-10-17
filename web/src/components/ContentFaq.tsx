import { inlineMarkdown } from '../lib/inlineMarkdown'
import type { FaqPair } from '../types'

/** «Вопросы и ответы» (same markup as PageHtml::faqBlock): answers are in the HTML, <details> folds them. */
export function ContentFaq({ items }: { items: FaqPair[] }) {
  if (!items.length) return null
  return <section className="content-faq" aria-labelledby="content-faq-title">
    <h2 id="content-faq-title">Вопросы и ответы</h2>
    {items.map((pair, index) => <details className="content-faq__item" key={index}>
      <summary>{pair.question}</summary>
      <div className="content-faq__answer">{pair.answer.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/).map((paragraph, key) => <p key={key}>{inlineMarkdown(paragraph.replace(/\n/g, ' '))}</p>)}</div>
    </details>)}
  </section>
}

/** «12+ · 45–60 минут, без антракта · от 900 ₽» (mirrors PageHtml::detailsLine). */
export function detailsLine(details?: { age_rating: string | null; duration_min: number | null; duration_max: number | null; has_intermission: boolean; price_from: number | null }): string {
  if (!details) return ''
  const parts: string[] = []
  if (details.age_rating) parts.push(details.age_rating)
  const { duration_min: min, duration_max: max } = details
  if (min !== null || max !== null) {
    const range = min !== null && max !== null && min !== max ? `${min}–${max}` : String(max ?? min)
    parts.push(`${range} минут${details.has_intermission ? ', с антрактом' : ', без антракта'}`)
  }
  if (details.price_from !== null) parts.push(`от ${details.price_from.toLocaleString('ru-RU').replace(/ /g, ' ')} ₽`)
  return parts.join(' · ')
}
