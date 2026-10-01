import { useRef } from 'react'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { LoadError } from '../components/LoadError'
import { SmoothLink } from '../components/SmoothLink'
import { usePublicResource } from '../hooks/usePublicResource'
import { useReveal } from '../hooks/useReveal'
import { articleDate } from '../lib/articleDate'
import type { ArticleSummary } from '../types'

export default function ArticlesPage() {
  const root = useRef<HTMLElement>(null)
  const { data: articles = [], status, retry } = usePublicResource<ArticleSummary[]>('/public/articles')
  useReveal(root, '.article-card', status === 'ready')
  if (status === 'error') return <section className="simple-page"><LoadError retry={retry} /></section>
  if (status === 'loading') return <div className="page-wash" aria-hidden="true" />
  return <section ref={root} className="articles-page">
    <Breadcrumbs items={[{ name: 'Главная', path: '/' }, { name: 'Статьи' }]} />
    <h1>Статьи</h1>
    {articles.length === 0 ? <p className="articles-page__empty">Скоро здесь появятся первые статьи.</p> : <div className="article-grid">
      {articles.map((article, index) => <article className="article-card" key={article.id}>
        <SmoothLink className="article-card__link" to={`/articles/${article.slug}`}>
          <img className="article-card__image" src={article.cover_image} alt="" width="1200" height="800" loading={index < 3 ? 'eager' : 'lazy'} decoding="async" />
          <div className="article-card__copy">
            <p className="article-card__date"><time dateTime={article.published_on}>{articleDate(article.published_on)}</time></p>
            <h2>{article.title}</h2>
            <p>{article.excerpt}</p>
          </div>
        </SmoothLink>
      </article>)}
    </div>}
  </section>
}
