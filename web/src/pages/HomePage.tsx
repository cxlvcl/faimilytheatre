import { useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Footer } from '../components/Footer'
import { MusiciansStrip } from '../components/MusiciansStrip'
import { useReveal } from '../hooks/useReveal'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { TheatreLettering } from '../components/TheatreLettering'
import { createHeroVideoPlayback, heroVideoSources } from '../lib/heroVideo'

gsap.registerPlugin(ScrollTrigger)

function Hero() {
  const root = useRef<HTMLElement>(null)
  const [playIntro] = useState(() => {
    try {
      return sessionStorage.getItem('theatre_intro_seen') !== '1'
    } catch {
      return true
    }
  })

  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const video = element.querySelector('video')
    const visual = element.querySelector<HTMLElement>('.hero__visual')
    const playback = video && visual ? createHeroVideoPlayback(video, visual, element) : null
    const menu = document.querySelector<HTMLElement>('.site-header__menu')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finish = () => {
      document.body.classList.remove('intro-active')
      window.dispatchEvent(new Event('theatre:intro-complete'))
      gsap.set(menu, { clearProps: 'opacity,visibility' })
      playback?.setVisible(true)
    }

    // Mark the session on entry, so leaving during the intro cannot replay it.
    if (playIntro) {
      try {
        sessionStorage.setItem('theatre_intro_seen', '1')
      } catch { /* The current mount still completes if storage is unavailable. */ }
    }
    const context = gsap.context(() => {
      if (!playIntro || reduce) {
        gsap.set(['.hero__logo', '.hero__visual', '.hero__slogan'], { autoAlpha: 1 })
        finish()
        return
      }
      document.body.classList.add('intro-active')
      gsap.timeline({ defaults: { ease: 'power2.out' }, onComplete: finish })
        .set('.hero__logo', { autoAlpha: 0, scale: 0.96, filter: 'blur(12px)' })
        .set('.hero__visual', { autoAlpha: 0 })
        .set('.hero__slogan', { autoAlpha: 0, filter: 'blur(12px)', y: 18 })
        .set(menu, { autoAlpha: 0 })
        .to('.hero__logo', { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 1 }, 0.4)
        .to('.hero__visual', { autoAlpha: 1, duration: 1, onComplete: () => playback?.setVisible(true) }, 2)
        .to('.hero__slogan', { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: 0.85 }, 3)
        .to(menu, { autoAlpha: 1, duration: 0.35 }, 3.85)
    }, root)

    return () => {
      playback?.dispose()
      context.revert()
      finish()
    }
  }, [playIntro])

  return (
    <section ref={root} className="hero" data-intro={playIntro} aria-label="Театр Музыки и Песка">
      <div className="hero__visual" data-video-playing="false">
      <video
        className="hero__media hero__video"
        muted
        loop
        playsInline
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        tabIndex={-1}
        preload="metadata"
        aria-hidden="true"
      >
        <source src={heroVideoSources.hdr} type={'video/mp4; codecs="hvc1"'} />
        <source src={heroVideoSources.standard} type="video/mp4" />
      </video>
      <img className="hero__media hero__poster" src={heroVideoSources.poster} alt="" aria-hidden="true" width="3840" height="2160" fetchPriority="high" />
      <div className="hero__overlay" />
      </div>
      <div className="hero__logo-position">
        <img className="hero__logo" src="/media/logo.webp" alt="Театр Музыки и Песка" width="900" height="900" fetchPriority="high" />
      </div>
      <h1 className="hero__slogan"><span className="sr-only">Волшебство начинается — здесь</span><TheatreLettering lines={['Волшебство', 'начинается — здесь']} /></h1>
    </section>
  )
}

function About() {
  const root = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (!root.current) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: { trigger: root.current, start: 'top 70%', once: true },
      })
      timeline
        .fromTo(
          '.about__phrase',
          { autoAlpha: 0, scale: reduce ? 1 : 0.96, y: reduce ? 0 : 26 },
          { autoAlpha: 1, scale: 1, y: 0, duration: reduce ? 0.35 : 0.95, ease: 'power2.out' },
        )
        .set('.about__image-wrap', { autoAlpha: 1 })
        .fromTo(
          '.about__image-wrap img',
          {
            autoAlpha: reduce ? 0 : 0.12,
            filter: reduce ? 'blur(0px)' : 'blur(24px) brightness(2.35) contrast(0.65)',
          },
          {
            autoAlpha: 1,
            filter: 'blur(0px) brightness(1) contrast(1)',
            duration: reduce ? 0.45 : 1.45,
            ease: 'power2.out',
          },
          '+=0.12',
        )
        .fromTo(
          '.about__fog',
          { autoAlpha: 1 },
          { autoAlpha: 0, duration: reduce ? 0.42 : 1.5, ease: 'power1.inOut' },
          '<',
        )
        .fromTo(
          '.about__fog-cloud--left',
          { xPercent: -12, scale: 1.12, autoAlpha: 0.96 },
          { xPercent: -68, scale: 1.48, autoAlpha: 0, duration: 1.5, ease: 'power2.inOut' },
          '<',
        )
        .fromTo(
          '.about__fog-cloud--right',
          { xPercent: 12, scale: 1.08, autoAlpha: 0.92 },
          { xPercent: 66, scale: 1.5, autoAlpha: 0, duration: 1.55, ease: 'power2.inOut' },
          '<',
        )
        .fromTo(
          ['.about__intro', '.about__final'],
          { autoAlpha: 0, y: reduce ? 0 : 22, filter: reduce ? 'blur(0px)' : 'blur(9px)' },
          { autoAlpha: 1, y: 0, filter: 'blur(0px)', stagger: 0.2, duration: 0.72 },
          '-=0.24',
        )
    }, root)
    return () => context.revert()
  }, [])

  return (
    <section ref={root} className="about">
      <h2 className="about__phrase">
        <span className="sr-only">Театр Музыки и Песка — где сказка становится кино, а кино — живым</span>
        <TheatreLettering lines={['Театр Музыки и Песка —', 'где сказка становится кино,', 'а кино — живым']} />
      </h2>
      <div className="about__image-wrap">
        <div className="about__photo-surface">
          <img src="/media/about-theatre.png" alt="Музыканты Театра Музыки и Песка" width="1448" height="1086" loading="lazy" />
        </div>
        <div className="about__fog" aria-hidden="true">
          <span className="about__fog-cloud about__fog-cloud--left" />
          <span className="about__fog-cloud about__fog-cloud--right" />
        </div>
      </div>
      <p className="about__intro">
        Театр Музыки и Песка — это не просто детский спектакль. Это современное перформанс-искусство,
        где музыка, слово и визуальная поэзия сливаются в единый поток эмоций.
      </p>
      <p className="about__final">Это не просто шоу — это ритуал, медитация, вызов гравитации и времени.</p>
    </section>
  )
}

function Musicians() {
  return (
    <section className="musicians" aria-labelledby="musicians-title">
      <h2 id="musicians-title">Люди которые создают волшебство</h2>
      <MusiciansStrip />
    </section>
  )
}

function Partners() {
  const root = useRef<HTMLElement>(null)
  useReveal(root, '.partners__logo')
  return (
    <section ref={root} className="partners" aria-labelledby="partners-title">
      <h2 id="partners-title">Партнёры театра</h2>
      <div className="partners__grid">
        {[1, 2, 3, 4].map((logo) => (
          <div className="partners__logo" key={logo}>
            <img src={`/media/partners/${logo}.webp`} alt={`Партнёр театра ${logo}`} loading="lazy" />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function HomePage() {
  useDocumentTitle('')
  return (
    <div className="home-page">
      <Hero />
      <About />
      <Musicians />
      <Partners />
      <Footer />
    </div>
  )
}
