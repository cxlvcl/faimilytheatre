import { useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { LoadError } from '../components/LoadError'
import { SmoothLink } from '../components/SmoothLink'
import { usePageH1 } from '../hooks/usePageH1'
import { usePublicResource } from '../hooks/usePublicResource'
import { useReveal } from '../hooks/useReveal'
import { articleDate } from '../lib/articleDate'
import type { ArticleSummary } from '../types'

export default function ArticlesPage() {
  const root = useRef<HTMLElement>(null)
  const [params, setParams] = useSearchParams()
  const { data: articles = [], status, retry } = usePublicResource<ArticleSummary[]>('/public/articles')
  const h1 = usePageH1('Статьи')
  const rubric = params.get('rubric')
  // Rubric filter: only the rubrics that have articles.
  const rubrics = [...new Map(articles.filter(article => article.rubric).map(article => [article.rubric!.slug, article.rubric!])).values()]
  const shown = rubric ? articles.filter(article => article.rubric?.slug === rubric) : articles
  useReveal(root, '.article-card', status === 'ready' ? `${shown.length}-${rubric}` : false)
  if (status === 'error') return <section className="simple-page"><LoadError retry={retry} /></section>
  if (status === 'loading') return <div className="page-wash" aria-hidden="true" />
  return <section ref={root} className="articles-page">
    <Breadcrumbs items={[{ name: 'Главная', path: '/' }, { name: 'Статьи' }]} />
    <h1>{h1}</h1>
    {rubrics.length > 0 && <nav className="article-rubrics" aria-label="Рубрики">
      {[{ slug: null, name: 'Все' }, ...rubrics].map(item => <button key={item.slug ?? 'all'} type="button" className={item.slug === rubric ? 'is-current' : ''} aria-pressed={item.slug === rubric} onClick={() => setParams(item.slug ? { rubric: item.slug } : {}, { replace: true })}>{item.name}</button>)}
    </nav>}
    {shown.length === 0 ? <p className="articles-page__empty">Скоро здесь появятся первые статьи.</p> : <div className="article-grid">
      {shown.map((article, index) => <article className="article-card" key={article.id}>
        <SmoothLink className="article-card__link" to={`/articles/${article.slug}`}>
          <img className="article-card__image" src={article.cover_image} alt={article.cover_alt ?? ''} width="1200" height="800" loading={index < 3 ? 'eager' : 'lazy'} decoding="async" />
          <div className="article-card__copy">
            <p className="article-card__date"><time dateTime={article.published_on}>{articleDate(article.published_on)}</time>{article.rubric && <> · {article.rubric.name}</>}</p>
            <h2>{article.title}</h2>
            <p>{article.excerpt}</p>
          </div>
        </SmoothLink>
      </article>)}
    </div>}
  </section>
}
