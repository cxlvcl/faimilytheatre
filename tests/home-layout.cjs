const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const postcss = require('postcss')

// Source-level regression guards; intentionally no browser automation.
const sheet = postcss.parse(fs.readFileSync('web/src/styles/refresh.css', 'utf8'))
function declarations(selector, mobile = false) {
  const values = {}
  sheet.walkRules(selector, rule => {
    const isMobile = rule.parent.type === 'atrule' && rule.parent.params === '(max-width: 680px)'
    if (isMobile !== mobile || (!mobile && rule.parent.type === 'atrule')) return
    rule.walkDecls(declaration => { values[declaration.prop] = declaration.value })
  })
  return values
}

test('Hero keeps the original full-screen photo composition', () => {
  const desktop = declarations('.hero')
  assert.equal(desktop.height, '100svh')
  assert.equal(desktop['aspect-ratio'], undefined)
  assert.equal(declarations('.hero', true)['aspect-ratio'], undefined)
  assert.equal(declarations('.hero__media')['object-fit'], 'cover')
  assert.equal(declarations('.hero__media')['object-position'], 'center 55%')
  assert.equal(declarations('.hero__media', true)['object-position'], 'center')
})

test('Contact logo overrides the fixed HTML height and preserves square proportions', () => {
  const desktop = declarations('.site-footer__logo')
  assert.equal(desktop.height, 'auto')
  assert.equal(desktop['aspect-ratio'], '1')
  assert.equal(desktop['object-fit'], 'contain')
  assert.ok(!declarations('.site-footer__logo', true).height, 'Mobile must keep automatic proportional height')
  const markup = fs.readFileSync('web/src/components/Footer.tsx', 'utf8')
  assert.match(markup, /className="site-footer__logo"[^>]+width="800" height="800"/)
})

test('Contact logo reveal animates a bounded wrapper, never the image colour filter', () => {
  const markup = fs.readFileSync('web/src/components/Footer.tsx', 'utf8')
  assert.match(markup, /<div data-reveal className="site-footer__logo-reveal">\s*<img className="site-footer__logo"[^>]*\/>\s*<\/div>/)
  const image = markup.match(/<img\b[^>]*className="site-footer__logo"[^>]*>/)[0]
  assert.ok(!image.includes('data-reveal'), 'GSAP blur must not override invert(1) on the image')
  assert.equal(declarations('.site-footer__logo').filter, 'invert(1)')
  const wrapper = declarations('.site-footer__logo-reveal')
  assert.equal(wrapper.width, 'fit-content', 'Do not blur a full-width footer layer')
  assert.equal(wrapper.display, 'flow-root', 'Keep the existing image margins inside the reveal wrapper')
  assert.equal(wrapper.filter, undefined)
})

test('Logo uses a square frame and cannot inherit the intrinsic 900px height', () => {
  const frame = declarations('.hero__logo-position')
  const image = declarations('.hero__logo')
  assert.equal(frame.width, 'var(--hero-logo-size)')
  assert.equal(frame.height, frame.width)
  assert.equal(image.width, '100%')
  assert.equal(image.height, '100%')
  assert.equal(image['object-fit'], 'contain')
  assert.equal(image['aspect-ratio'], '1')
  assert.equal(declarations('.hero', true)['--hero-logo-size'], '74px')
  assert.ok(!declarations('.hero__logo', true).width, 'Mobile must resize the frame, not only the image width')
})

test('About lettering is smaller on desktop, with a readable separate mobile limit', () => {
  assert.equal(declarations('.about__phrase').width, 'min(78%, 620px)')
  assert.equal(declarations('.about__phrase', true).width, 'min(92%, 360px)')
  const markup = fs.readFileSync('web/src/pages/HomePage.tsx', 'utf8')
  assert.ok(markup.includes('Театр Музыки и Песка — истории, рассказанные музыкой, словом и песком'))
  assert.ok(markup.includes('<TheatreLettering variant="about" />'))
})
