import { useEffect, useRef } from 'react'

/** Full-screen poster view: closes on a click anywhere, the × button or Esc (native <dialog>). */
export function PosterLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      if (element.open) element.close()
    }
  }, [])
  return <dialog ref={dialog} className="poster-lightbox" aria-label={alt} onClose={onClose} onClick={() => dialog.current?.close()}>
    <img src={src} alt={alt} />
    <button type="button" className="poster-lightbox__close" aria-label="Закрыть">×</button>
  </dialog>
}
