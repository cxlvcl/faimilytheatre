export const heroVideoSources = {
  desktop: '/media/hero-2026-desktop.mp4',
  desktopPoster: '/media/hero-2026-desktop-poster.webp',
  mobile: '/media/hero-2026-mobile.mp4',
  mobilePoster: '/media/hero-2026-mobile-poster.webp',
  standard: '/media/hero-2026-desktop-1280.mp4',
} as const

export const heroMobileQuery = '(max-width: 680px), (orientation: portrait) and (max-width: 1024px)'

/** Portrait screens get the vertical cut; small or low-density desktops the 720p file. */
export function pickHeroVideo(): string {
  if (window.matchMedia(heroMobileQuery).matches) return heroVideoSources.mobile
  return window.innerWidth * Math.min(window.devicePixelRatio || 1, 2) >= 1600 ? heroVideoSources.desktop : heroVideoSources.standard
}

/** Decorative video: keep the separate poster visible until playback really starts. */
export function createHeroVideoPlayback(
  video: HTMLVideoElement,
  visual: HTMLElement,
  viewportTarget: HTMLElement,
  fallback: string = heroVideoSources.standard,
) {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let visible = false
  let inView = false
  let disposed = false
  let pending = false
  let autoplayBlocked = false
  let failed = false
  let usingStandard = video.getAttribute('src') === fallback
  let attempt = 0

  // Set DOM properties as well as attributes before the first play() call in Safari.
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  video.controls = false
  video.setAttribute('muted', '')
  video.setAttribute('playsinline', '')
  visual.dataset.videoPlaying = 'false'

  const allowed = () => visible && inView && !document.hidden && !motion.matches && !disposed
  const showPoster = () => { visual.dataset.videoPlaying = 'false' }
  const pause = () => {
    attempt += 1
    pending = false
    showPoster()
    video.pause()
  }

  const fallbackToStandard = () => {
    showPoster()
    if (usingStandard) {
      failed = true
      pause()
      return
    }
    usingStandard = true
    attempt += 1
    pending = false
    video.src = fallback
    video.load()
    updatePlayback()
  }

  function updatePlayback(userGesture = false) {
    if (!allowed()) {
      pause()
      return
    }
    if (userGesture) autoplayBlocked = false
    if (pending || failed || autoplayBlocked || (!video.paused && !video.ended)) return

    const currentAttempt = ++attempt
    pending = true
    const rejected = (error: unknown) => {
      if (disposed || currentAttempt !== attempt) return
      pending = false
      showPoster()
      const name = error instanceof Error ? error.name : ''
      if (name === 'NotAllowedError') autoplayBlocked = true
      // Do not switch formats when the browser merely disallows autoplay.
      if (name === 'NotSupportedError') fallbackToStandard()
    }
    try {
      void Promise.resolve(video.play()).then(() => {
        if (disposed || currentAttempt !== attempt) return
        pending = false
        if (!allowed()) pause()
      }, rejected)
    } catch (error) {
      rejected(error)
    }
  }

  const playing = () => {
    if (!allowed()) {
      pause()
      return
    }
    autoplayBlocked = false
    visual.dataset.videoPlaying = 'true'
  }
  const mediaError = () => {
    showPoster()
    if (video.error?.code === 3 || video.error?.code === 4) fallbackToStandard()
  }
  const retry = () => updatePlayback()
  const gesture = () => updatePlayback(true)
  const observer = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting
    updatePlayback()
  })

  video.addEventListener('playing', playing)
  video.addEventListener('pause', showPoster)
  video.addEventListener('ended', showPoster)
  video.addEventListener('error', mediaError)
  video.addEventListener('canplay', retry)
  motion.addEventListener('change', retry)
  document.addEventListener('visibilitychange', retry)
  // No play button. A normal interaction may permit muted playback after a denial.
  document.addEventListener('pointerup', gesture, { passive: true })
  document.addEventListener('keydown', gesture)
  observer.observe(viewportTarget)

  return {
    setVisible(value: boolean) {
      visible = value
      updatePlayback()
    },
    dispose() {
      disposed = true
      observer.disconnect()
      video.removeEventListener('playing', playing)
      video.removeEventListener('pause', showPoster)
      video.removeEventListener('ended', showPoster)
      video.removeEventListener('error', mediaError)
      video.removeEventListener('canplay', retry)
      motion.removeEventListener('change', retry)
      document.removeEventListener('visibilitychange', retry)
      document.removeEventListener('pointerup', gesture)
      document.removeEventListener('keydown', gesture)
      pause()
    },
  }
}
