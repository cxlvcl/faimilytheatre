import { useRef } from 'react'
import { useReveal } from '../hooks/useReveal'

export function Footer() {
  const root = useRef<HTMLElement>(null)
  useReveal(root)

  return (
    <footer ref={root} id="contacts" className="site-footer">
      <div data-reveal className="site-footer__logo-reveal">
        <img className="site-footer__logo" src="/media/contact-logo.webp" alt="Театр Музыки и Песка" width="800" height="800" loading="lazy" decoding="async" />
      </div>
      <div data-reveal className="site-footer__contacts">
        <p className="site-footer__city">Нижний Новгород</p>
        <div>
          <a href="tel:+78314235804">+7 (831) 423-58-04</a>
          <a href="tel:+79290535804">+7 (929) 053-58-04</a>
          <a href="mailto:info@teatrmip-nn.ru">info@teatrmip-nn.ru</a>
        </div>
      </div>
      <div className="site-footer__legal">
        <p>© All Right Reserved. Театр Музыки и Песка.</p>
        <p>ИП Доброхотова Н.М. ИНН 525715626730</p>
        <p>ОГРН 316527500079224</p>
      </div>
    </footer>
  )
}
