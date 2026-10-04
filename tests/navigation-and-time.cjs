const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function load(file, mocks = {}, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(code, { exports, require: name => mocks[name] ?? require(name), ...globals })
  return exports
}

function elements(node) {
  if (!React.isValidElement(node)) return []
  return [node, ...React.Children.toArray(node.props.children).flatMap(elements)]
}

function menu(pathname, reduce = false) {
  const effects = [], layouts = [], refs = [], navigations = [], scrolls = []
  const classes = new Set(), attributes = new Set(['inert']), listeners = new Map()
  let closed = 0
  const timeline = { set() { return this }, fromTo() { return this }, pause() {}, kill() {}, eventCallback() { return this }, timeScale() { return this }, play() { return this } }
  const root = { setAttribute: name => attributes.add(name), removeAttribute: name => attributes.delete(name), style: { setProperty() {}, removeProperty() {} } }
  const { FullscreenMenu } = load('web/src/components/FullscreenMenu.tsx', {
    react: { ...React, useRef: value => { const ref = { current: value }; refs.push(ref); return ref }, useEffect: callback => effects.push(callback), useLayoutEffect: callback => layouts.push(callback), useCallback: callback => callback },
    gsap: { timeline: () => timeline, set() {}, to: (_element, options) => options.onComplete() },
    'react-router-dom': { Link: 'a', useLocation: () => ({ pathname }), useNavigate: () => target => navigations.push(target) },
    '../pages/HomePage': {}, '../pages/RepertoirePage': {}, '../pages/AfishaPage': {}, '../pages/FaqPage': {}, '../pages/FranchisePage': {},
    '../lib/pageTransition': { waitForPageReady: async () => {} }, '../lib/routePreload': { preloadRoute: () => Promise.resolve() },
  }, {
    document: { documentElement: { dataset: {} }, activeElement: { focus() {} }, body: { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } }, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name), getElementById: () => ({ focus() {} }) },
    window: { matchMedia: () => ({ matches: reduce }), setTimeout: callback => { callback(); return 1 }, clearTimeout() {}, scrollTo: options => scrolls.push(options) },
    requestAnimationFrame: callback => callback(),
  })
  const tree = FullscreenMenu({ open: true, onClosed: () => { closed++ } })
  refs[0].current = root
  refs[1].current = { focus() {} }
  for (const callback of layouts) callback()
  for (const callback of effects) callback()
  return { nodes: elements(tree), classes, attributes, navigations, scrolls, listeners, closed: () => closed }
}

async function click(node, overrides = {}) {
  let prevented = false
  node.props.onClick({ button: 0, preventDefault() { prevented = true }, ...overrides })
  await new Promise(resolve => setImmediate(resolve))
  return prevented
}

test('Every section can return home through the fullscreen menu or its logo', async () => {
  for (const pathname of ['/afisha', '/repertoire', '/repertoire/test', '/faq', '/franchise']) {
    for (const control of ['item', 'logo']) {
      const state = menu(pathname)
      assert.ok(state.classes.has('menu-open'))
      assert.ok(!state.attributes.has('inert'))
      const link = state.nodes.find(node => node.props.to === '/' && node.props.className?.includes(`menu-overlay__${control}`))
      assert.ok(link, `Missing home ${control} from ${pathname}`)
      assert.ok(await click(link))
      assert.deepEqual(state.navigations, ['/'])
      assert.equal(state.closed(), 1)
      assert.ok(!state.classes.has('menu-open'))
      assert.ok(state.attributes.has('inert'))
      await click(link)
      assert.equal(state.closed(), 1, 'Repeated click must not start another transition')
    }
  }
})

test('Home link scrolls to the hero when already on home, including reduced motion', async () => {
  for (const reduce of [false, true]) {
    const state = menu('/', reduce)
    const link = state.nodes.find(node => node.props.to === '/' && node.props.children === 'Главная')
    assert.equal(link.props['aria-current'], 'page')
    await click(link)
    assert.equal(state.scrolls[0].top, 0)
    assert.deepEqual(state.navigations, [])
    assert.equal(state.closed(), 1)
  }
})

test('Modified link clicks retain browser behavior; Escape closes without navigating', async () => {
  const state = menu('/afisha')
  const link = state.nodes.find(node => node.props.children === 'Главная')
  assert.equal(await click(link, { metaKey: true }), false)
  assert.equal(state.closed(), 0)
  state.listeners.get('keydown')({ key: 'Escape', preventDefault() {} })
  assert.equal(state.closed(), 1)
  assert.deepEqual(state.navigations, [])
})

test('Afisha renders entered local start time and does not invent midnight for old records', () => {
  const { EventDate } = load('web/src/components/EventDate.tsx')
  for (const time of ['00:00', '09:05', '18:30', '23:59']) {
    const html = renderToStaticMarkup(React.createElement(EventDate, { date: '2099-01-01', time }))
    assert.ok(html.toLowerCase().includes(`datetime="2099-01-01t${time}"`))
    assert.ok(html.includes(`Начало в ${time}`))
  }
  const html = renderToStaticMarkup(React.createElement(EventDate, { date: '2099-01-01', time: null }))
  assert.ok(html.toLowerCase().includes('datetime="2099-01-01"'))
  assert.ok(!html.includes('Начало в') && !html.includes('00:00'))
})
