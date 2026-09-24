import { SmoothLink } from '../components/SmoothLink'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('Страница не найдена')
  return (
    <section className="simple-page simple-page--dark not-found-page">
      <h1>Страница не найдена</h1>
      <SmoothLink to="/">На главную</SmoothLink>
    </section>
  )
}

