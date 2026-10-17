import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Footer } from '../components/Footer'
import { MusiciansStrip } from '../components/MusiciansStrip'
import { useReveal } from '../hooks/useReveal'
import { UpcomingDates } from '../components/UpcomingDates'
import { createHeroVideoPlayback, heroMobileQuery, heroVideoSources, pickHeroVideo } from '../lib/heroVideo'

// power2 curves from the former GSAP timeline, as CSS easings for the Web Animations API.
const easeInOut = 'cubic-bezier(.45, 0, .55, 1)'
const easeIn = 'cubic-bezier(.55, .085, .68, .53)'
const easeOut = 'cubic-bezier(.25, .46, .45, .94)'

/** Waits until the image can be painted without a decode pause, at most `limit` ms. */
function decoded(image: HTMLImageElement | null, limit: number): Promise<void> {
  if (!image) return Promise.resolve()
  const ready = image.complete && image.naturalWidth > 0 ? image.decode() : new Promise<void>(resolve => {
    image.addEventListener('load', () => { image.decode().then(resolve, resolve) }, { once: true })
    image.addEventListener('error', () => resolve(), { once: true })
  })
  return Promise.race([ready.catch(() => undefined), new Promise<void>(resolve => setTimeout(resolve, limit))])
}

function Hero() {
  const root = useRef<HTMLElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const visual = useRef<HTMLDivElement>(null)
  const [playIntro] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return sessionStorage.getItem('theatre_intro_seen') !== '1' } catch { return true }
  })
  useEffect(() => {
    const element = video.current
    if (!element || !visual.current || !root.current) return
    const source = pickHeroVideo()
    element.setAttribute('src', source)
    const playback = createHeroVideoPlayback(element, visual.current, root.current, source === heroVideoSources.mobile ? source : heroVideoSources.standard)
    // Play at once, under the intro: the first frames are ready when the hero fades in.
    playback.setVisible(true)
    return () => playback.dispose()
  }, [])
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const logo = element.querySelector<HTMLImageElement>('.hero__logo')
    const center = element.querySelector<HTMLElement>('.hero__center')
    const centerLogo = element.querySelector<HTMLImageElement>('.hero__center-logo')
    const hero = visual.current
    const menu = document.querySelector<HTMLElement>('.site-header__menu')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const shown = [hero, centerLogo]
    let animations: Animation[] = []
    let done = false
    const finish = () => {
      if (done) return
      done = true
      // End state inline (the data-intro CSS hides these), then release the animation layers.
      for (const node of shown) if (node) { node.style.opacity = '1'; node.style.visibility = 'visible' }
      logo?.style.removeProperty('visibility')
      document.documentElement.classList.remove('intro-pending')
      document.body.classList.remove('intro-active')
      window.dispatchEvent(new Event('theatre:intro-complete'))
      // The header drops its intro class in the next render; only then hand «Меню» back to CSS.
      const finished = animations
      animations = []
      requestAnimationFrame(() => {
        for (const animation of finished) animation.cancel()
        menu?.style.removeProperty('visibility')
      })
    }
    if (playIntro) {
      try { sessionStorage.setItem('theatre_intro_seen', '1') } catch { /* session-only animation */ }
    }
    document.documentElement.classList.remove('intro-pending')
    if (!playIntro || reduce || !logo || !center || !hero || typeof logo.animate !== 'function') {
      // The small intro logo is only part of the intro; afterwards the hero shows one logo.
      finish()
      return
    }
    document.body.classList.add('intro-active')
    const travel = element.clientHeight / 2 - logo.offsetHeight / 2 - (logo.parentElement?.offsetTop ?? 20)
    const lift = (scale: number) => `translateY(${travel}px) scale(${scale})`
    const centered = (scale: number) => `translate(-50%, -51.4%) scale(${scale})`
    for (const node of [logo, hero, centerLogo, menu]) if (node) node.style.visibility = 'visible'
    if (centerLogo) centerLogo.style.opacity = '1'
    // Opacity and transform only: the compositor runs them even while the page is still busy.
    const run = (node: HTMLElement | null, keyframes: Keyframe[], delay: number, duration: number, easing = 'linear') => {
      if (!node) return
      const animation = node.animate(keyframes, { delay, duration, easing, fill: 'both' })
      animation.pause()
      animations.push(animation)
    }
    // The intro logo fades in, holds, then dissolves in place (one animation: no fill overlap).
    // It is fully gone at 2250 ms, before the hero logo appears: the two are never on screen together.
    run(logo, [
      { offset: 0, opacity: 0, transform: lift(1.65) },
      { offset: .08, opacity: 0, transform: lift(1.65), easing: easeInOut },
      { offset: .42, opacity: 1, transform: lift(1.65) },
      { offset: .58, opacity: 1, transform: lift(1.65), easing: easeIn },
      { offset: .9, opacity: 0, transform: lift(1.8) },
      { offset: 1, opacity: 0, transform: lift(1.8) },
    ], 0, 2500)
    run(hero, [{ opacity: 0 }, { opacity: 1 }], 1350, 1100, easeInOut)
    // The glowing logo's wrapper carries the drop-shadow: animating it keeps the glow rasterised once.
    // It starts at 1% (invisible on black), not 0: Chrome then counts the logo as painted from the
    // first frame (LCP) instead of only after a compositor-only fade has ended.
    run(center, [{ opacity: .01, transform: centered(.94) }, { opacity: 1, transform: centered(1) }], 2300, 1200, easeOut)
    run(menu, [{ opacity: 0 }, { opacity: 1 }], 2800, 400, easeInOut)
    // Start only when both logos are decoded: no pause in the middle of the fade.
    void Promise.all([decoded(logo, 1500), decoded(centerLogo, 1500)]).then(() => {
      if (done) return
      for (const animation of animations) animation.play()
      Promise.all(animations.map(animation => animation.finished)).then(finish, () => undefined)
    })
    return finish
  }, [playIntro])

  return <section ref={root} className="hero" data-intro={playIntro} aria-label="Театр Музыки и Песка">
    <div ref={visual} className="hero__visual" data-video-playing="false">
      <video ref={video} className="hero__media hero__video" autoPlay muted playsInline loop preload="auto" aria-hidden="true" tabIndex={-1} disablePictureInPicture />
      <picture>
        <source media={heroMobileQuery} srcSet={heroVideoSources.mobilePoster} width="720" height="1280" />
        <img className="hero__media hero__poster" src={heroVideoSources.desktopPoster} alt="" width="1920" height="1080" fetchPriority="high" />
      </picture>
      <div className="hero__overlay" />
    </div>
    <div className="hero__logo-position"><img className="hero__logo" src="/media/logo.webp?v=2525ae2f" alt="" width="900" height="900" /></div>
    <h1 className="hero__center"><span className="sr-only">Театр Музыки и Песка</span><img className="hero__center-logo" src="/media/hero-center-logo.webp" alt="" width="683" height="1024" fetchPriority="high" /></h1>
  </section>
}

function About() {
  const root = useRef<HTMLElement>(null)
  useReveal(root, '.about__text p')
  return <section ref={root} id="about" className="about about--text">
    <h2 className="sr-only">Театр Музыки и Песка — истории, рассказанные музыкой, словом и песком</h2>
    <div className="about__text">
      <p>Театр Музыки и Песка — единственный в Нижегородской области проект, где живая музыка соединяется с кинематографичной песочной анимацией. На большом экране разворачивается детализированная история из цветного песка, а вживую звучит струнный квартет и голос чтеца — никакой фонограммы.</p>
      <p>Мы ставим классику — Пушкина, Андерсена, Гоголя, Сент-Экзюпери, Бажова — так, чтобы дети её поняли, а взрослые вспомнили. В репертуаре более 27 спектаклей: для малышей, которые идут в театр впервые, для школьников с классом, для семей на выходных и для взрослых, которые ищут не развлечение, а настоящее переживание.</p>
      <p>Играем в арт-клубе «Маяковка 10» и в ЦК «Рекорд» в Нижнем Новгороде, выезжаем со спектаклями в школы, дворцы культуры и на другие площадки города и области.</p>
      <p className="about__closing">Театр Музыки и Песка — искусство, которое видят сердцем.</p>
    </div>
  </section>
}

function Musicians() {
  return <section className="musicians" aria-labelledby="musicians-title"><h2 id="musicians-title">Люди, которые создают волшебство</h2><MusiciansStrip /></section>
}

// Files are cropped to the visible mark, so CSS sizes each logo by its optical weight.
const partners = [
  { file: 'dobrohot', name: 'Доброхот', width: 634, height: 1074 },
  { file: 'mayakovka', name: 'Арт-клуб «Маяковка, 10»', width: 846, height: 130 },
  { file: 'qtickets', name: 'Qtickets', width: 864, height: 578 },
  { file: 'kassir', name: 'KASSIR.RU', width: 842, height: 214 },
]

function Partners() {
  const root = useRef<HTMLElement>(null)
  useReveal(root, '.partners__logo')
  return <section ref={root} className="partners" aria-labelledby="partners-title">
    <h2 id="partners-title">Партнёры театра</h2>
    <div className="partners__grid">{partners.map(logo => <div className={`partners__logo partners__logo--${logo.file}`} key={logo.file}><img src={`/media/partners/${logo.file}.webp`} alt={logo.name} width={logo.width} height={logo.height} loading="lazy" decoding="async" /></div>)}</div>
  </section>
}

export default function HomePage() {
  return <div className="home-page"><Hero /><UpcomingDates /><About /><Musicians /><Partners /><Footer /></div>
}
