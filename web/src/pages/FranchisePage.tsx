import { type FormEvent, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { useReveal } from '../hooks/useReveal'
import { ApiError, publicApi } from '../lib/api'

gsap.registerPlugin(ScrollTrigger)

const benefits = [
  ['01', 'Готовый репертуар', 'Спектакли, сценарии, партитуры и песочная анимация.'],
  ['02', 'Подготовка команды', 'Помощь с подбором артистов, репетициями и подготовкой к премьере.'],
  [
    '03',
    'Продвижение и продажи',
    'Готовые материалы и инструменты для работы со зрителями, школами и культурными площадками.',
  ],
  [
    '04',
    'Сопровождение',
    'Помощь с техническими и организационными вопросами не только во время запуска, но и после него.',
  ],
]

const path = [
  ['01', 'Договор', 'Начинаем работу и передаём необходимые материалы.'],
  ['02', 'Команда', 'Помогаем сформировать состав и подобрать исполнителей.'],
  ['03', 'Репетиции', 'Сопровождаем подготовку спектакля и техническую настройку.'],
  ['04', 'Премьера', 'Помогаем подготовиться к первым показам и запуску продаж.'],
  ['05', 'Развитие', 'Остаёмся на связи после запуска и сопровождаем дальнейшую работу театра.'],
]

interface FormValues {
  name: string
  city: string
  phone: string
  website: string
}

const initialValues: FormValues = { name: '', city: '', phone: '', website: '' }

export default function FranchisePage() {
  const root = useRef<HTMLDivElement>(null)
  const [values, setValues] = useState<FormValues>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'success'>('idle')
  const [serverError, setServerError] = useState('')
  useReveal(root)

  useLayoutEffect(() => {
    if (!root.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const context = gsap.context(() => {
      gsap.fromTo(
        '.franchise-hero__background',
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.8, ease: 'power2.out', clearProps: 'opacity,visibility' },
      )
      gsap.fromTo(
        '.franchise-hero__content > *',
        { autoAlpha: 0, y: 16, filter: 'blur(4px)' },
        { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.75, stagger: 0.1, clearProps: 'opacity,visibility,filter,transform' },
      )
      if (!reduce) {
        gsap.fromTo(
          '.franchise-path__line-progress',
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: '.franchise-path__steps',
              start: 'top 72%',
              end: 'bottom 45%',
              scrub: 0.55,
            },
          },
        )
      } else {
        gsap.set('.franchise-path__line-progress', { scaleY: 1 })
      }
    }, root)
    return () => context.revert()
  }, [])

  const update = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
    setServerError('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitState === 'sending') return
    const nextErrors: Record<string, string> = {}
    if (values.name.trim().length < 2) nextErrors.name = 'Введите имя'
    if (values.city.trim().length < 2) nextErrors.city = 'Введите город'
    const digits = values.phone.replace(/\D/g, '').length
    if (digits < 7 || digits > 15 || !/^[+\d\s().-]+$/.test(values.phone)) nextErrors.phone = 'Введите телефон'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setSubmitState('sending')
    setServerError('')
    try {
      await publicApi.franchise({
        name: values.name.trim(),
        city: values.city.trim(),
        phone: values.phone.trim(),
        website: values.website,
      })
      setSubmitState('success')
    } catch (error) {
      setSubmitState('idle')
      if (error instanceof ApiError) {
        setErrors(error.fields)
        setServerError(
          error.code === 'rate_limited'
            ? 'Слишком много попыток. Попробуйте немного позже.'
            : 'Не удалось отправить заявку. Попробуйте ещё раз.',
        )
      } else {
        setServerError('Не удалось отправить заявку. Попробуйте ещё раз.')
      }
    }
  }

  return (
    <div ref={root} className="franchise-page">
      <section className="franchise-hero">
        <img className="franchise-hero__background" src="/media/franchise-swan.webp" alt="" width="1500" height="964" fetchPriority="high" />
        <div className="franchise-hero__shade" />
        <div className="franchise-hero__content">
          <Breadcrumbs items={[{ name: 'Главная', path: '/' }, { name: 'Франшиза' }]} />
          <h1>
            Откройте Театр Музыки и Песка
            <br />в своём городе
          </h1>
          <p>
            Театр, где живая музыка, художественное слово и песочная анимация соединяются в единое
            представление.
          </p>
          <p>
            Мы передаём партнёру готовые спектакли, все необходимые материалы и сопровождаем запуск — чтобы
            Театр Музыки и Песка мог начать свою историю в новом городе.
          </p>
        </div>
      </section>

      <section className="franchise-benefits section-light">
        <h2 data-reveal>Всё необходимое для запуска театра</h2>
        <div className="franchise-benefits__grid">
          {benefits.map(([number, title, copy]) => (
            <article data-reveal key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="franchise-mobility section-light">
        <h2 data-reveal>
          Театр там,
          <br />где есть зритель
        </h2>
        <div data-reveal>
          <p>
            Спектакли не требуют собственной стационарной сцены. Театр может работать в школах, домах
            культуры, библиотеках и на других подходящих площадках.
          </p>
          <p>
            Минимум сложных декораций и мобильный формат позволяют работать в разных пространствах и расширять
            географию показов.
          </p>
        </div>
      </section>

      <section className="franchise-economy">
        <h2 data-reveal>Экономика, которую можно посчитать</h2>
        <div className="franchise-economy__figures">
          <div data-reveal>
            <strong>от 150 000 ₽</strong>
            <span>стартовый пакет</span>
          </div>
          <div data-reveal>
            <strong>0 ₽</strong>
            <span>роялти первые 4 месяца</span>
          </div>
          <div data-reveal>
            <strong>6–9 месяцев</strong>
            <span>ориентировочный срок окупаемости</span>
          </div>
        </div>
        <p data-reveal className="franchise-economy__note">
          После первых четырёх месяцев роялти составляет 10 000 ₽ в месяц. Финансовые показатели основаны на
          опыте головной площадки в Нижегородской области и могут отличаться в зависимости от региона,
          количества показов и работы партнёра.
        </p>
      </section>

      <section className="franchise-path section-light">
        <h2 data-reveal>
          От решения
          <br />до первого спектакля
        </h2>
        <div className="franchise-path__steps">
          <div className="franchise-path__line" aria-hidden="true">
            <span className="franchise-path__line-progress" />
          </div>
          {path.map(([number, title, copy]) => (
            <article data-reveal key={number}>
              <span>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="franchise-form-scene">
        <img src="/media/franchise-masterpieces.webp" alt="" className="franchise-form-scene__background" loading="lazy" />
        <div className="franchise-form-scene__shade" />
        <div className="franchise-form-scene__inner">
          <div data-reveal className="franchise-form-scene__copy">
            <h2>
              Создайте Театр Музыки и Песка
              <br />в своём городе
            </h2>
            <p>
              Расскажите нам о себе и городе, в котором вы хотите открыть театр. Мы свяжемся с вами и обсудим
              возможности запуска.
            </p>
          </div>

          {submitState === 'success' ? (
            <div className="franchise-form__success" role="status">
              <strong>Спасибо. Ваша заявка отправлена.</strong>
              <span>Мы свяжемся с вами в ближайшее время.</span>
            </div>
          ) : (
            <form data-reveal className="franchise-form" onSubmit={submit} noValidate>
              <label>
                <span>Имя</span>
                <input
                  name="name"
                  value={values.name}
                  onChange={(event) => update('name', event.target.value)}
                  maxLength={100}
                  autoComplete="name"
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && <small>{errors.name}</small>}
              </label>
              <label>
                <span>Город</span>
                <input
                  name="city"
                  value={values.city}
                  onChange={(event) => update('city', event.target.value)}
                  maxLength={100}
                  autoComplete="address-level2"
                  aria-invalid={Boolean(errors.city)}
                />
                {errors.city && <small>{errors.city}</small>}
              </label>
              <label>
                <span>Телефон</span>
                <input
                  name="phone"
                  type="tel"
                  value={values.phone}
                  onChange={(event) => update('phone', event.target.value)}
                  maxLength={32}
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.phone)}
                />
                {errors.phone && <small>{errors.phone}</small>}
              </label>
              <label className="honeypot" aria-hidden="true">
                Сайт
                <input
                  name="website"
                  value={values.website}
                  onChange={(event) => update('website', event.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
              {serverError && <p className="franchise-form__error" role="alert">{serverError}</p>}
              <button type="submit" disabled={submitState === 'sending'} aria-busy={submitState === 'sending'}>
                Обсудить франшизу
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
