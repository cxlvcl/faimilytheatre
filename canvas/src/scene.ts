/**
 * One WebGL renderer for the whole page. Its canvas is not on the page: each painting is rendered into a
 * viewport of it (setViewport/setScissor) and the frame is copied into a 2D <canvas> inside that painting's
 * stage. The copy scrolls natively with the text, so scrolling needs no WebGL frames and never lags on iOS;
 * frames are rendered only while a painting moves.
 */
import {
  Box3, BoxGeometry, DirectionalLight, Group, HemisphereLight, MathUtils, Mesh, MeshStandardMaterial,
  PerspectiveCamera, PlaneGeometry, PointLight, Scene, SRGBColorSpace, Texture, WebGLRenderer,
} from 'three'
import { createFrameKit } from './frames'
import type { Painting, View3D } from './painting'

const FOV = 20
const MAX_DPR = 2
/** Textures kept on the GPU at once; phones get fewer (iOS reloads tabs that use too much memory). */
const TEXTURE_LIMIT = window.matchMedia('(pointer: coarse)').matches ? 6 : 14

interface Item {
  group: Group
  material: MeshStandardMaterial
  texture: Texture
  /** Front of the frame, in front of the painting surface (world units). */
  front: number
  used: number
  output: HTMLCanvasElement | null
  context: CanvasRenderingContext2D | null
  sharp: boolean
}

interface Callbacks { lost(): void; restored(): void }

/** Lets the browser handle input between the heavy steps, so no step blocks a phone for long. */
const pause = () => new Promise<void>(resolve => window.setTimeout(resolve, 0))

export async function createView(callbacks: Callbacks): Promise<View3D | null> {
  const canvas = document.createElement('canvas')
  let renderer: WebGLRenderer
  try {
    // Software WebGL (no GPU, blocklisted driver) would freeze a phone: such devices keep the flat images.
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'default', failIfMajorPerformanceCaveat: true })
  } catch {
    return null
  }
  renderer.setPixelRatio(1)
  renderer.setClearColor(0x000000, 0)
  renderer.setScissorTest(true)

  const scene = new Scene()
  // Warm key light from the top left: it slides across the frame and the surface as the painting turns.
  const key = new DirectionalLight(0xfff0dc, 2.6)
  key.position.set(-1.6, 2.2, 3)
  scene.add(key)
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100)

  // A soft fill from above and a weak point light in front (the gilding itself is a matcap, see frames.ts).
  scene.add(new HemisphereLight(0xfff6e8, 0x2a2018, 0.75))
  const sheen = new PointLight(0xffe2b0, 3, 0, 2)
  sheen.position.set(1.2, 0.8, 2.4)
  scene.add(sheen)
  const frames = createFrameKit()
  const linenBack = new MeshStandardMaterial({ color: 0x2E2924, roughness: 1 })
  const linenEdge = new MeshStandardMaterial({ color: 0xB8AE9C, roughness: 0.95 })
  const stretcher = new MeshStandardMaterial({ color: 0x5E4B37, roughness: 0.85 })
  const items = new Map<Painting, Item>()
  let lost = false
  let width = 0
  let height = 0

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault()
    lost = true
    callbacks.lost()
  })
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false
    // GPU copies are gone: textures upload again.
    for (const item of items.values()) item.texture.needsUpdate = true
    callbacks.restored()
  })

  function build(painting: Painting, texture: Texture, frame: Group | null): Item {
    const a = painting.aspect
    const group = new Group()
    const material = new MeshStandardMaterial({ map: texture, roughness: 0.8, metalness: 0 })
    group.add(new Mesh(new PlaneGeometry(a, 1), material))

    // Stretched canvas: light linen edges, a dark back and a wooden stretcher with one cross bar.
    const depth = 0.03
    const body = new Mesh(new BoxGeometry(a, 1, depth), [linenEdge, linenEdge, linenEdge, linenEdge, linenBack, linenBack])
    body.position.z = -depth / 2 - 0.0005
    group.add(body)
    const bar = 0.045 * Math.min(a, 1)
    const barDepth = 0.02
    const z = -depth - barDepth / 2
    const bars: [number, number, number, number][] = [
      [a - 0.01, bar, 0, 0.5 - bar / 2 - 0.005], [a - 0.01, bar, 0, -(0.5 - bar / 2 - 0.005)],
      [bar, 1 - 2 * bar - 0.01, a / 2 - bar / 2 - 0.005, 0], [bar, 1 - 2 * bar - 0.01, -(a / 2 - bar / 2 - 0.005), 0],
      a >= 1 ? [bar, 1 - 2 * bar - 0.01, 0, 0] : [a - 2 * bar - 0.01, bar, 0, 0],
    ]
    for (const [w, h, x, y] of bars) {
      const mesh = new Mesh(new BoxGeometry(w, h, barDepth), stretcher)
      mesh.position.set(x, y, z)
      group.add(mesh)
    }

    let front = 0
    if (frame) {
      group.add(frame)
      front = Math.max(0, new Box3().setFromObject(frame).max.z)
    }
    group.visible = false
    scene.add(group)
    return { group, material, texture, front, used: performance.now(), output: null, context: null, sharp: false }
  }

  function makeTexture(source: HTMLImageElement): Texture {
    const texture = new Texture(source)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
    texture.needsUpdate = true
    return texture
  }

  /** Least recently drawn textures of paintings away from the viewport leave the GPU first. */
  function evict() {
    const loaded = [...items.entries()].filter(([, item]) => item.material.map)
    if (loaded.length <= TEXTURE_LIMIT) return
    loaded.sort(([, a], [, b]) => a.used - b.used)
    for (const [painting, item] of loaded.slice(0, loaded.length - TEXTURE_LIMIT)) {
      if (painting.near) continue
      item.texture.dispose()
      item.material.map = null
      item.material.needsUpdate = true
      item.sharp = false
    }
  }

  function output(painting: Painting, item: Item): CanvasRenderingContext2D | null {
    if (!item.output) {
      item.output = document.createElement('canvas')
      item.output.className = 'cv-stage__gl'
      item.output.setAttribute('aria-hidden', 'true')
      painting.stage.append(item.output)
    }
    item.context ??= item.output.getContext('2d')
    return item.context
  }

  const view: View3D = {
    async prepare(painting) {
      if (lost) return false
      const image = painting.image
      if (!image.complete || !image.naturalWidth) {
        const ok = await new Promise<boolean>(resolve => {
          image.addEventListener('load', () => resolve(true), { once: true })
          image.addEventListener('error', () => resolve(false), { once: true })
        })
        if (!ok) return false
      }
      // A copy of the chosen file (from the HTTP cache): srcset may later swap the <img> to another size,
      // and a texture must keep the dimensions it was created with.
      const source = new Image()
      source.src = image.currentSrc || image.src
      // The frame model loads alongside; a painting whose model fails still turns, without a frame.
      const frame = !items.has(painting) && painting.model ? frames.load(painting.model).catch(() => null) : Promise.resolve(null)
      if (!await source.decode().then(() => true, () => false) || lost) return false
      let item = items.get(painting)
      if (!item) {
        item = build(painting, makeTexture(source), await frame)
        items.set(painting, item)
      } else if (!item.material.map) {
        item.texture = makeTexture(source)
        item.material.map = item.texture
        item.material.needsUpdate = true
      }
      // Texture upload and shader compilation each in a task of their own, before the first frame.
      await pause()
      if (lost) return false
      renderer.initTexture(item.texture)
      await pause()
      for (const other of items.values()) other.group.visible = other === item
      await renderer.compileAsync(scene, camera)
      evict()
      return !lost
    },

    draw(painting) {
      const item = items.get(painting)
      if (!item || lost || !item.material.map) return
      const context = output(painting, item)
      if (!context) return
      const stageWidth = painting.stage.clientWidth
      const stageHeight = painting.stage.clientHeight
      if (!stageWidth || !stageHeight) return
      // Room around the stage for the corners of a turned painting.
      const marginX = Math.round(stageWidth * 0.12 + 12)
      const marginY = Math.round(stageHeight * 0.18 + 12)
      const viewWidth = stageWidth + 2 * marginX
      const viewHeight = stageHeight + 2 * marginY
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      const pixelWidth = Math.round(viewWidth * dpr)
      const pixelHeight = Math.round(viewHeight * dpr)
      if (pixelWidth > width || pixelHeight > height) {
        width = Math.max(width, pixelWidth)
        height = Math.max(height, pixelHeight)
        renderer.setSize(width, height, false)
      }
      const out = item.output!
      if (out.width !== pixelWidth || out.height !== pixelHeight) {
        out.width = pixelWidth
        out.height = pixelHeight
        Object.assign(out.style, { left: `${-marginX}px`, top: `${-marginY}px`, width: `${viewWidth}px`, height: `${viewHeight}px` })
      }

      // The front of the frame fills the stage exactly, as the <img> did before.
      const outerHeight = 1 + 2 * painting.border
      const visibleHeight = outerHeight * viewHeight / stageHeight
      camera.aspect = viewWidth / viewHeight
      camera.position.set(0, 0, visibleHeight / (2 * Math.tan(MathUtils.degToRad(FOV / 2))) + item.front)
      camera.near = camera.position.z / 20
      camera.far = camera.position.z * 3
      if (painting.zoom > 1.001) {
        const zoomedWidth = viewWidth * painting.zoom
        const zoomedHeight = viewHeight * painting.zoom
        camera.setViewOffset(zoomedWidth, zoomedHeight,
          zoomedWidth / 2 + painting.cx * stageWidth * painting.zoom - viewWidth / 2,
          zoomedHeight / 2 + painting.cy * stageHeight * painting.zoom - viewHeight / 2,
          viewWidth, viewHeight)
      } else camera.clearViewOffset()
      camera.updateProjectionMatrix()
      item.group.rotation.set(MathUtils.degToRad(painting.rotX), MathUtils.degToRad(painting.rotY + painting.autoY), 0)

      for (const other of items.values()) other.group.visible = other === item
      renderer.setViewport(0, 0, pixelWidth, pixelHeight)
      renderer.setScissor(0, 0, pixelWidth, pixelHeight)
      renderer.render(scene, camera)
      item.used = performance.now()
      context.clearRect(0, 0, pixelWidth, pixelHeight)
      // WebGL counts rows from the bottom: the viewport sits in the lower left corner of the canvas.
      context.drawImage(canvas, 0, height - pixelHeight, pixelWidth, pixelHeight, 0, 0, pixelWidth, pixelHeight)
    },

    release(painting) {
      const item = items.get(painting)
      if (!item?.output) return
      item.output.remove()
      item.output.width = item.output.height = 0
      item.output = null
      item.context = null
    },

    sharpen(painting) {
      const item = items.get(painting)
      const source = painting.image.currentSrc
      if (!item || item.sharp || !source.includes('-1024.')) return
      item.sharp = true
      const image = new Image()
      image.src = source.replace('-1024.', '-2048.')
      image.decode().then(() => {
        if (lost || !item.material.map) return
        item.texture.dispose()
        item.texture = makeTexture(image)
        item.material.map = item.texture
        item.material.needsUpdate = true
        if (painting.gl) view.draw(painting)
      }, () => { item.sharp = false })
    },
  }
  return view
}
