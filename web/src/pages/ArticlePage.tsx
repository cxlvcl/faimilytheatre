import { useParams } from 'react-router-dom'
import { ArticleMarkdown } from '../components/ArticleMarkdown'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { LoadError } from '../components/LoadError'
import { SmoothLink } from '../components/SmoothLink'
import { usePublicResource } from '../hooks/usePublicResource'
import { articleDate } from '../lib/articleDate'
import type { Article } from '../types'

export default function ArticlePage() {
  const { slug = '' } = useParams()
  const { data: article, status, retry } = usePublicResource<Article>(`/public/articles/${encodeURIComponent(slug)}`)
  if (status === 'not-found') return <section className="simple-page"><h1>Статья не найдена</h1><SmoothLink to="/articles">Все статьи</SmoothLink></section>
  if (status === 'error') return <section className="simple-page"><LoadError retry={retry} /></section>
  if (!article || status === 'loading') return <div className="page-wash" aria-hidden="true" />
  return <article className="article-detail">
    <header className="article-detail__header">
      <Breadcrumbs items={[{ name: 'Главная', path: '/' }, { name: 'Статьи', path: '/articles' }, { name: article.title }]} />
      <p className="article-detail__date"><time dateTime={article.published_on}>{articleDate(article.published_on)}</time></p>
      <h1>{article.title}</h1>
      <p className="article-detail__lead">{article.excerpt}</p>
    </header>
    <img className="article-detail__cover" src={article.cover_image} alt="" width="1600" height="900" fetchPriority="high" />
    <ArticleMarkdown value={article.body} className="article-detail__body" />
    <footer className="article-detail__footer"><SmoothLink to="/articles">Все статьи</SmoothLink></footer>
  </article>
}
