/** State of one painting on the page; main.ts moves it, a view (WebGL or CSS) draws it. */

export class Painting {
  readonly slug: string
  readonly aspect: number
  /** Frame width in units of the painting height (0 without a frame). */
  readonly border: number
  /** Frame model (GLB from canvas/blender/frames.py); empty for a painting without a frame. */
  readonly model: string
  readonly stage: HTMLButtonElement
  readonly body: HTMLElement
  readonly image: HTMLImageElement
  readonly text: HTMLElement
  readonly inner: HTMLElement

  /** Rotation in degrees: user's around the vertical (y) and horizontal (x) axes, plus the one-off hint turn. */
  rotY = 0
  rotX = 0
  autoY = 0
  /** Inertia, degrees per millisecond. */
  velY = 0
  velX = 0
  springing = false
  springVY = 0
  springVX = 0
  springTimer = 0
  autoStart = -1
  autoDone = false
  held = false

  /** Zoom 1…2.5; the centre of the view in stage units (−0.5…0.5), x to the right, y down. */
  zoom = 1
  zoomTo = 1
  cx = 0
  cy = 0
  cxTo = 0
  cyTo = 0

  near = false
  visible = false
  /** Drawn by WebGL; otherwise the <img> with a CSS tilt. */
  gl = false
  tapTimer = 0
  suppressClick = false

  constructor(readonly el: HTMLElement, readonly index: number) {
    this.slug = el.dataset.slug ?? ''
    this.aspect = Number(el.dataset.aspect) || 1
    this.border = Number(el.dataset.border) || 0
    this.model = el.dataset.model ?? ''
    this.stage = el.querySelector<HTMLButtonElement>('.cv-stage')!
    this.body = el.querySelector<HTMLElement>('.cv-stage__body')!
    this.image = el.querySelector<HTMLImageElement>('.cv-stage__image')!
    this.text = el.querySelector<HTMLElement>('.cv-text')!
    this.inner = el.querySelector<HTMLElement>('.cv-text__inner')!
  }

  /** WebGL shows the back of the painting; the flat fallback only tilts. */
  get maxY(): number { return this.gl ? 180 : 15 }
  get maxX(): number { return this.gl ? 25 : 15 }
}

export interface View3D {
  /** Texture and objects for the painting; resolves false when the image cannot be used. */
  prepare(painting: Painting): Promise<boolean>
  draw(painting: Painting): void
  /** Frees the on-page bitmap of a painting far from the viewport. */
  release(painting: Painting): void
  /** Sharper texture for zooming in on phones. */
  sharpen(painting: Painting): void
}
