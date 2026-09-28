import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Footer } from '../components/Footer'
import { MusiciansStrip } from '../components/MusiciansStrip'
import { useReveal } from '../hooks/useReveal'
import { TheatreLettering } from '../components/TheatreLettering'

gsap.registerPlugin(ScrollTrigger)

function Hero() {
  const root = useRef<HTMLElement>(null)
  const [playIntro] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return sessionStorage.getItem('theatre_intro_seen') !== '1' } catch { return true }
  })
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
        gsap.set(['.hero__logo', '.hero__visual', '.hero__slogan'], { autoAlpha: 1 })
        finish()
        return
      }
      const logoPosition = logo.parentElement
      const travel = element.clientHeight / 2 - logo.offsetHeight / 2 - (logoPosition?.offsetTop ?? 20)
      document.body.classList.add('intro-active')
      gsap.timeline({ defaults: { ease: 'power2.inOut' }, onComplete: finish })
        .set(logo, { autoAlpha: 0, y: travel, scale: 1.65, filter: 'invert(0) blur(6px)' })
        .set('.hero__visual', { autoAlpha: 0 })
        .set('.hero__slogan', { autoAlpha: 0, y: 14, filter: 'blur(5px)' })
        .set(menu, { autoAlpha: 0 })
        .to(logo, { autoAlpha: 1, filter: 'invert(0) blur(0px)', duration: 0.85 }, 0.2)
        .to('.hero__visual', { autoAlpha: 1, duration: 1.1 }, 1.35)
        .to(logo, { y: 0, scale: 1, filter: 'invert(1) blur(0px)', duration: 1.1 }, 1.35)
        .to('.hero__slogan', { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.9, clearProps: 'filter,transform' }, 2.05)
        .to(menu, { autoAlpha: 1, duration: 0.3 }, 2.7)
    }, element)
    document.documentElement.classList.remove('intro-pending')
    return () => { context.revert(); finish() }
  }, [playIntro])

  return <section ref={root} className="hero" data-intro={playIntro} aria-label="Театр Музыки и Песка">
    <div className="hero__visual">
      <picture>
        <source media="(max-width: 680px)" srcSet="/media/hero-mobile-600.webp 600w, /media/hero-mobile.webp 941w" sizes="100vw" width="941" height="1672" />
        <img className="hero__media" src="/media/hero-desktop.webp" srcSet="/media/hero-desktop-1000.webp 1000w, /media/hero-desktop.webp 1672w" sizes="100vw" alt="Артисты Театра Музыки и Песка" width="1672" height="941" fetchPriority="high" />
      </picture>
      <div className="hero__overlay" />
    </div>
    <div className="hero__logo-position"><img className="hero__logo" src="/media/logo.webp?v=2525ae2f" alt="Театр Музыки и Песка" width="900" height="900" /></div>
    <h1 className="hero__slogan"><span className="sr-only">Волшебство начинается — здесь</span><TheatreLettering variant="hero" /></h1>
  </section>
}

function About() {
  const root = useRef<HTMLElement>(null)
  useReveal(root, '.about__phrase, .about__image-wrap, .about__intro, .about__final')
  return <section ref={root} id="about" className="about">
    <h2 className="about__phrase">
      <span className="sr-only">Театр Музыки и Песка — истории, рассказанные музыкой, словом и песком</span>
      <TheatreLettering variant="about" />
    </h2>
    <div className="about__image-wrap"><img src="/media/about-team.webp" alt="Артисты Театра Музыки и Песка в чёрно-белой фотокомпозиции" width="1024" height="1536" loading="lazy" decoding="async" /></div>
    <p className="about__intro">Мы делаем спектакли, в которых музыка звучит вживую, истории рассказывают со сцены, а рисунки из песка появляются прямо на глазах.</p>
    <div className="about__final"><p>Нам хочется, чтобы после спектакля с человеком что-то осталось.</p><p>Какая-то мелодия, образ, фраза или просто настроение, к которому потом неожиданно возвращаешься.</p></div>
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
  return <div className="home-page"><Hero /><About /><Musicians /><Partners /><Footer /></div>
}
