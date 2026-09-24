import assert from 'node:assert/strict'
import test from 'node:test'
import { createHeroVideoPlayback, heroVideoSources } from '../web/src/lib/heroVideo.ts'

const flush = () => new Promise(resolve => setImmediate(resolve))
const rejection = name => Promise.reject(new DOMException(name, name))

function fixture(t) {
  const originals = new Map(['window', 'document', 'IntersectionObserver'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]))
  const motion = Object.assign(new EventTarget(), { matches: false })
  const document = Object.assign(new EventTarget(), { hidden: false })
  const visual = { dataset: {} }
  let observer

  class Video extends EventTarget {
    paused = true
    ended = false
    error = null
    src = ''
    playCalls = 0
    loadCalls = 0
    attributes = new Map()
    playResult = () => Promise.resolve()
    getAttribute(name) { return this.attributes.get(name) ?? null }
    setAttribute(name, value) { this.attributes.set(name, value) }
    play() { this.playCalls += 1; return this.playResult() }
    pause() { this.paused = true; this.dispatchEvent(new Event('pause')) }
    load() { this.loadCalls += 1; this.paused = true; this.error = null }
    playing() { this.paused = false; this.dispatchEvent(new Event('playing')) }
  }
  const video = new Video()
  globalThis.window = { matchMedia: () => motion }
  globalThis.document = document
  globalThis.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; observer = this }
    observe(target) { this.target = target }
    disconnect() { this.disconnected = true }
    notify(isIntersecting) { this.callback([{ isIntersecting }]) }
  }
  const playback = createHeroVideoPlayback(video, visual, visual)
  t.after(() => {
    playback.dispose()
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  })
  return {
    video, visual, playback, motion, document, observer,
    reveal() { observer.notify(true); playback.setVisible(true) },
  }
}

test('waits for both intro visibility and intersection before requesting playback', async t => {
  const f = fixture(t)
  assert.equal(f.video.playCalls, 0)
  assert.equal(f.visual.dataset.videoPlaying, 'false')
  f.observer.notify(true)
  assert.equal(f.video.playCalls, 0)
  f.playback.setVisible(true)
  assert.equal(f.video.playCalls, 1)
  await flush()
})

test('does not play a revealed hero outside the viewport', t => {
  const f = fixture(t)
  f.playback.setVisible(true)
  f.document.dispatchEvent(new Event('pointerup'))
  assert.equal(f.video.playCalls, 0)
})

test('poster remains above native controls until an actual playing event', async t => {
  const f = fixture(t)
  f.reveal()
  await flush()
  assert.equal(f.visual.dataset.videoPlaying, 'false')
  f.video.playing()
  assert.equal(f.visual.dataset.videoPlaying, 'true')
  f.video.pause()
  assert.equal(f.visual.dataset.videoPlaying, 'false')
})

test('sets Safari mute/inline properties and attributes with controls disabled', t => {
  const { video } = fixture(t)
  assert.equal(video.muted, true)
  assert.equal(video.defaultMuted, true)
  assert.equal(video.playsInline, true)
  assert.equal(video.controls, false)
  assert.equal(video.getAttribute('muted'), '')
  assert.equal(video.getAttribute('playsinline'), '')
})

test('autoplay denial leaves the poster, does not loop or change codec, and can retry on interaction', async t => {
  const f = fixture(t)
  f.video.playResult = () => rejection('NotAllowedError')
  f.reveal()
  await flush()
  f.video.dispatchEvent(new Event('canplay'))
  f.playback.setVisible(true)
  assert.equal(f.video.playCalls, 1)
  assert.equal(f.video.loadCalls, 0)
  assert.equal(f.visual.dataset.videoPlaying, 'false')
  f.video.playResult = () => Promise.resolve()
  f.document.dispatchEvent(new Event('pointerup'))
  assert.equal(f.video.playCalls, 2)
  f.video.playing()
  await flush()
  assert.equal(f.visual.dataset.videoPlaying, 'true')
})

test('coalesces play requests while the browser has a pending request', async t => {
  const f = fixture(t)
  let resolve
  f.video.playResult = () => new Promise(done => { resolve = done })
  f.reveal()
  f.video.dispatchEvent(new Event('canplay'))
  f.document.dispatchEvent(new Event('keydown'))
  f.playback.setVisible(true)
  assert.equal(f.video.playCalls, 1)
  resolve()
  await flush()
})

test('pauses with a poster in a hidden tab and resumes when visible', async t => {
  const f = fixture(t)
  f.reveal()
  f.video.playing()
  await flush()
  f.document.hidden = true
  f.document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(f.video.paused, true)
  assert.equal(f.visual.dataset.videoPlaying, 'false')
  f.document.dispatchEvent(new Event('pointerup'))
  assert.equal(f.video.playCalls, 1)
  f.document.hidden = false
  f.document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(f.video.playCalls, 2)
  await flush()
})

test('respects reduced motion even after a gesture and reacts to preference changes', async t => {
  const f = fixture(t)
  f.motion.matches = true
  f.reveal()
  f.document.dispatchEvent(new Event('pointerup'))
  f.document.dispatchEvent(new Event('keydown'))
  assert.equal(f.video.playCalls, 0)
  f.motion.matches = false
  f.motion.dispatchEvent(new Event('change'))
  assert.equal(f.video.playCalls, 1)
  f.video.playing()
  await flush()
  f.motion.matches = true
  f.motion.dispatchEvent(new Event('change'))
  assert.equal(f.video.paused, true)
  assert.equal(f.visual.dataset.videoPlaying, 'false')
})

test('pauses outside the viewport and retries on re-entry', async t => {
  const f = fixture(t)
  f.reveal()
  f.video.playing()
  await flush()
  f.observer.notify(false)
  assert.equal(f.visual.dataset.videoPlaying, 'false')
  f.observer.notify(true)
  assert.equal(f.video.playCalls, 2)
  await flush()
})

test('falls back from unsupported HDR to existing 4K MP4 only once', async t => {
  const f = fixture(t)
  f.video.playResult = () => rejection('NotSupportedError')
  f.reveal()
  await flush()
  assert.equal(f.video.src, heroVideoSources.standard)
  assert.equal(f.video.loadCalls, 1)
  assert.equal(f.video.playCalls, 2)
  assert.equal(f.visual.dataset.videoPlaying, 'false')
  f.video.dispatchEvent(new Event('canplay'))
  f.document.dispatchEvent(new Event('pointerup'))
  assert.equal(f.video.playCalls, 2)
})

test('a decoder error also switches to the standard 4K source', async t => {
  const f = fixture(t)
  f.reveal()
  f.video.playing()
  await flush()
  f.video.error = { code: 3 }
  f.video.dispatchEvent(new Event('error'))
  assert.equal(f.video.src, heroVideoSources.standard)
  assert.equal(f.video.loadCalls, 1)
  assert.equal(f.visual.dataset.videoPlaying, 'false')
  f.video.playing()
  await flush()
  assert.equal(f.visual.dataset.videoPlaying, 'true')
})

test('an old rejected request does not block a newer request after leaving the viewport', async t => {
  const f = fixture(t)
  let reject
  f.video.playResult = () => new Promise((_, fail) => { reject = fail })
  f.reveal()
  f.observer.notify(false)
  f.video.playResult = () => Promise.resolve()
  f.observer.notify(true)
  f.video.playing()
  reject(new DOMException('old request', 'NotAllowedError'))
  await flush()
  assert.equal(f.visual.dataset.videoPlaying, 'true')
  assert.equal(f.video.playCalls, 2)
})

test('cleanup removes listeners and ignores asynchronous codec errors', async t => {
  const f = fixture(t)
  let reject
  f.video.playResult = () => new Promise((_, fail) => { reject = fail })
  f.reveal()
  f.playback.dispose()
  reject(new DOMException('late failure', 'NotSupportedError'))
  await flush()
  f.document.dispatchEvent(new Event('pointerup'))
  f.document.dispatchEvent(new Event('keydown'))
  f.document.dispatchEvent(new Event('visibilitychange'))
  f.video.dispatchEvent(new Event('canplay'))
  assert.equal(f.observer.disconnected, true)
  assert.equal(f.video.playCalls, 1)
  assert.equal(f.video.loadCalls, 0)
  assert.equal(f.visual.dataset.videoPlaying, 'false')
})
