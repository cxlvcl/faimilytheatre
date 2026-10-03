import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Footer } from '../components/Footer'
import { MusiciansStrip } from '../components/MusiciansStrip'
import { useReveal } from '../hooks/useReveal'
import { TheatreLettering } from '../components/TheatreLettering'
import { UpcomingDates } from '../components/UpcomingDates'
import { createHeroVideoPlayback, heroMobileQuery, heroVideoSources, pickHeroVideo } from '../lib/heroVideo'

gsap.registerPlugin(ScrollTrigger)

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
    const reveal = () => playback.setVisible(true)
    if (!document.body.classList.contains('intro-active')) reveal()
    window.addEventListener('theatre:intro-complete', reveal)
    return () => { window.removeEventListener('theatre:intro-complete', reveal); playback.dispose() }
  }, [])
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const logo = element.querySelector<HTMLElement>('.hero__logo')
    const menu = document.querySelector<HTMLElement>('.site-header__menu')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const finish = () => {
      document.documentElement.classList.remove('intro-pending')
      document.body.classList.remove('intro-active')
      window.dispatchEvent(new Event('theatre:intro-complete'))
      if (menu) gsap.set(menu, { clearProps: 'opacity,visibility' })
    }
    if (playIntro) {
      try { sessionStorage.setItem('theatre_intro_seen', '1') } catch { /* session-only animation */ }
    }
    const context = gsap.context(() => {
      if (!playIntro || reduce || !logo) {
        // The small intro logo is only part of the intro; afterwards the hero shows one logo.
        gsap.set(['.hero__visual', '.hero__center-logo'], { autoAlpha: 1 })
        finish()
        return
      }
      const logoPosition = logo.parentElement
      const travel = element.clientHeight / 2 - logo.offsetHeight / 2 - (logoPosition?.offsetTop ?? 20)
      document.body.classList.add('intro-active')
      gsap.timeline({ defaults: { ease: 'power2.inOut' }, onComplete: finish })
        .set(logo, { autoAlpha: 0, y: travel, scale: 1.65, filter: 'invert(0) blur(6px)' })
        .set('.hero__visual', { autoAlpha: 0 })
        .set('.hero__center-logo', { autoAlpha: 0, scale: .94, filter: 'blur(14px)' })
        .set(menu, { autoAlpha: 0 })
        .to(logo, { autoAlpha: 1, filter: 'invert(0) blur(0px)', duration: 0.85 }, 0.2)
        .to('.hero__visual', { autoAlpha: 1, duration: 1.1 }, 1.35)
        // The intro logo dissolves in place while the logo with the lettering appears there.
        .to(logo, { autoAlpha: 0, scale: 1.8, filter: 'invert(0) blur(10px)', duration: 0.95, ease: 'power2.in' }, 1.55)
        .to('.hero__center-logo', { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 1.3, ease: 'power2.out', clearProps: 'filter,transform' }, 2.05)
        .to(menu, { autoAlpha: 1, duration: 0.4 }, 2.8)
    }, element)
    document.documentElement.classList.remove('intro-pending')
    return () => { context.revert(); finish() }
  }, [playIntro])

  return <section ref={root} className="hero" data-intro={playIntro} aria-label="Театр Музыки и Песка">
    <div ref={visual} className="hero__visual" data-video-playing="false">
      <video ref={video} className="hero__media hero__video" muted playsInline loop preload="auto" aria-hidden="true" tabIndex={-1} disablePictureInPicture />
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
  useReveal(root, '.about__phrase, .about__text p')
  return <section ref={root} id="about" className="about about--text">
    <h2 className="about__phrase">
      <span className="sr-only">Театр Музыки и Песка — истории, рассказанные музыкой, словом и песком</span>
      <TheatreLettering variant="about" />
    </h2>
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

function Partners() {
  const root = useRef<HTMLElement>(null)
  useReveal(root, '.partners__logo')
  return <section ref={root} className="partners" aria-labelledby="partners-title">
    <h2 id="partners-title">Партнёры театра</h2>
    <div className="partners__grid">{[1, 2, 3, 4].map(logo => <div className="partners__logo" key={logo}><img src={`/media/partners/${logo}.webp`} alt="" width="300" height="180" loading="lazy" decoding="async" /></div>)}</div>
  </section>
}

export default function HomePage() {
  return <div className="home-page"><Hero /><UpcomingDates /><About /><Musicians /><Partners /><Footer /></div>
}
