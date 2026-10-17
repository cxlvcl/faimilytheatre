import { useParams } from 'react-router-dom'
import { ArticleMarkdown } from '../components/ArticleMarkdown'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { BuyLink } from '../components/BuyLink'
import { ContentFaq } from '../components/ContentFaq'
import { EventDate } from '../components/EventDate'
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
  const crumbs = [{ name: 'Главная', path: '/' }, { name: 'Статьи', path: '/articles' }, ...(article.rubric ? [{ name: article.rubric.name, path: `/articles?rubric=${article.rubric.slug}` }] : []), { name: article.title }]
  return <article className="article-detail">
    <header className="article-detail__header">
      <Breadcrumbs items={crumbs} />
      <p className="article-detail__date"><time dateTime={article.published_on}>{articleDate(article.published_on)}</time></p>
      <h1>{article.h1 || article.title}</h1>
      <p className="article-detail__lead">{article.excerpt}</p>
    </header>
    <img className="article-detail__cover" src={article.cover_image} alt={article.cover_alt ?? ''} width="1600" height="900" fetchPriority="high" />
    <ArticleMarkdown value={article.body} className="article-detail__body" />
    {article.author && <p className="article-detail__author">
      {article.author.photo && <img src={article.author.photo} alt="" width="56" height="56" loading="lazy" decoding="async" />}
      <span>{article.author.name}{article.author.position && <>, {article.author.position}</>}</span>
    </p>}
    {article.updated_on && <p className="article-detail__updated">Обновлено: <time dateTime={article.updated_on}>{articleDate(article.updated_on)}</time></p>}
    <ContentFaq items={article.faq ?? []} />
    {article.performances?.length > 0 && <section className="related-shows" aria-labelledby="related-shows">
      <h2 id="related-shows">Спектакли из статьи</h2>
      <div className="related-shows__list">{article.performances.map(show => <article className="related-show" key={show.id}>
        <SmoothLink className="related-show__cover" to={`/repertoire/${show.slug}`} aria-label={`О спектакле «${show.title}»`}>
          <img src={show.cover_image} alt="" width="750" height="1000" loading="lazy" decoding="async" />
        </SmoothLink>
        <div className="related-show__copy">
          <h3><SmoothLink to={`/repertoire/${show.slug}`}>{show.title}</SmoothLink></h3>
          {show.next_event ? <>
            <p className="related-show__date"><EventDate date={show.next_event.event_date} time={show.next_event.event_time} /> · {show.next_event.venue}</p>
            <BuyLink className="related-show__buy" event={show.next_event} title={show.title} />
          </> : <p className="related-show__date">Новые даты скоро появятся</p>}
        </div>
      </article>)}</div>
    </section>}
    <footer className="article-detail__footer"><SmoothLink to="/articles">Все статьи</SmoothLink></footer>
  </article>
}
