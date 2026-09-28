import { SmoothLink } from '../components/SmoothLink'

export default function NotFoundPage() {
  return (
    <section className="simple-page simple-page--dark not-found-page">
      <h1>Страница не найдена</h1>
      <SmoothLink to="/">На главную</SmoothLink>
    </section>
  )
}
