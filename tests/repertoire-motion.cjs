const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')

function load(file, mocks, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  vm.runInNewContext(code, { exports, require: name => mocks[name] ?? require(name), ...globals })
  return exports
}

function motion(reduce = false, kind = 'repertoire') {
  const timelines = [], contexts = [], listeners = new Map()
  const contents = Array.from({ length: 4 }, () => ({ style: { removeProperty() { delete this.willChange } } }))
  const scenes = contents.map(content => ({ querySelector: () => content }))
  const root = { querySelectorAll: selector => selector === `.${kind}-scene` ? scenes : contents }
  const preference = { matches: reduce, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name) }
  const gsap = {
    registerPlugin() {},
    context(callback) { const context = { reverted: false, revert() { this.reverted = true } }; contexts.push(context); callback(); return context },
    timeline(options) {
      const timeline = { options, steps: [], fromTo(target, from, to) { this.steps.push({ target, from, to }); return this }, to(target, to, position) { this.steps.push({ target, to, position }); return this } }
      timelines.push(timeline)
      return timeline
    },
  }
  const { setupRepertoireMotion } = load('web/src/lib/repertoireMotion.ts', { gsap, 'gsap/ScrollTrigger': { ScrollTrigger: {} } }, { window: { matchMedia: () => preference } })
  const cleanup = setupRepertoireMotion(root, kind)
  return { timelines, contexts, contents, preference, listeners, cleanup }
}

test('Each scene has one controller and scrolls only opacity and transform, never a filter', () => {
  const state = motion()
  assert.equal(state.timelines.length, 4)
  state.timelines.forEach((timeline, index) => {
    assert.equal(timeline.options.scrollTrigger.scrub, 0.16)
    assert.equal(timeline.steps.length, 2)
    assert.equal(timeline.steps[1].position, 0.78, 'Keep the content clear in the middle of the scene')
    for (const step of timeline.steps) {
      assert.equal(step.target, state.contents[index])
      for (const key of [...Object.keys(step.from ?? {}), ...Object.keys(step.to)]) assert.ok(['opacity', 'y', 'duration'].includes(key), `Unexpected scroll property: ${key}`)
    }
    timeline.options.scrollTrigger.onToggle({ isActive: true })
    assert.equal(state.contents[index].style.willChange, 'transform, opacity')
    timeline.options.scrollTrigger.onToggle({ isActive: false })
    assert.equal(state.contents[index].style.willChange, undefined)
  })
  state.cleanup()
  assert.ok(state.contexts.every(context => context.reverted))
  assert.equal(state.listeners.size, 0)
})

test('Afisha uses the same fade and keeps the first and last content readable', () => {
  const state = motion(false, 'event')
  assert.equal(state.timelines.length, 4)
  assert.equal(state.timelines[0].steps[0].from.opacity, 1)
  assert.equal(state.timelines[3].steps[1].to.opacity, 1)
  state.cleanup()
})

test('Reduced motion and unmount leave no scroll controllers or compositing hints', () => {
  const state = motion(true)
  assert.equal(state.timelines.length, 0)
  state.preference.matches = false
  state.listeners.get('change')()
  assert.equal(state.timelines.length, 4)
  state.timelines[0].options.scrollTrigger.onRefresh({ isActive: true })
  state.preference.matches = true
  state.listeners.get('change')()
  assert.ok(state.contexts.every(context => context.reverted))
  assert.ok(state.contents.every(content => content.style.willChange === undefined))
  state.cleanup()
  assert.equal(state.listeners.size, 0)
})

test('Covers keep their source quality, decode asynchronously and defer distant images', () => {
  const performances = Array.from({ length: 4 }, (_, id) => ({ id, slug: `show-${id}`, title: `Show ${id}`, short_description: 'Description', cover_image: `/uploads/original-${id}.webp` }))
  const { default: RepertoirePage } = load('web/src/pages/RepertoirePage.tsx', {
    react: { ...React, useRef: () => ({ current: null }), useLayoutEffect() {}, useMemo: factory => factory() },
    'react-router-dom': { useSearchParams: () => [new URLSearchParams(), () => {}] },
    '../components/LoadError': {}, '../components/SmoothLink': { SmoothLink: 'a' }, '../components/Breadcrumbs': { Breadcrumbs: () => null }, '../hooks/usePublicResource': { usePublicResource: () => ({ data: performances, status: 'ready' }) }, '../hooks/usePageH1': { usePageH1: fallback => fallback }, '../lib/repertoireMotion': {},
    '../lib/repertoireSections': load('web/src/lib/repertoireSections.ts', {}),
    '../lib/titleLine': load('web/src/lib/titleLine.ts', {}),
  })
  const collect = node => !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(collect)]
  const images = collect(RepertoirePage()).filter(node => node.type === 'img')
  assert.equal(images.length, 8)
  images.forEach((image, index) => {
    const scene = Math.floor(index / 2)
    assert.equal(image.props.src, performances[scene].cover_image)
    assert.equal(image.props.decoding, 'async')
    assert.equal(image.props.loading, scene < 2 ? 'eager' : 'lazy')
  })
  const styles = fs.readFileSync('web/src/styles/pages.css', 'utf8')
  assert.match(styles, /\.repertoire-scene__cover\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*4/)
  assert.match(styles, /\.repertoire-scene__cover img\s*\{[^}]*object-fit:\s*contain/)
})
