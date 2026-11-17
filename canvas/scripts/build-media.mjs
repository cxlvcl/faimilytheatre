// Images for /canvas from canvas/data/paintings.json: downloads the sources once into canvas/.cache,
// writes WebP files into canvas/public and fills «aspect» and «placeholder» back into the data file.
// Run: npm run media -w canvas
import { mkdir, readFile, writeFile, access, copyFile, stat } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const dataPath = join(root, 'data/paintings.json')
const cache = join(root, '.cache')
const paintingsOut = join(root, 'public/paintings')
const backgroundsOut = join(root, 'public/backgrounds')
const fontsOut = join(root, 'public/fonts')
const userAgent = 'TheatreCanvasBuilder/1.0 (https://xn--80aanbjgaodo1bgudcs1l.xn--p1ai)'
const data = JSON.parse(await readFile(dataPath, 'utf8'))
for (const path of [cache, paintingsOut, backgroundsOut, fontsOut]) await mkdir(path, { recursive: true })

const exists = path => access(path).then(() => true, () => false)

/** Wikimedia Commons file title → a ~2400px rendition (or the original when it is smaller). */
async function commonsUrl(title) {
  const query = new URLSearchParams({ action: 'query', titles: 'File:' + title, prop: 'imageinfo', iiprop: 'url|size', iiurlwidth: '2400', format: 'json' })
  const response = await fetch('https://commons.wikimedia.org/w/api.php?' + query, { headers: { 'User-Agent': userAgent } })
  const info = Object.values((await response.json()).query.pages)[0].imageinfo[0]
  return info.width <= 2400 ? info.url : info.thumburl
}

async function source(key, from) {
  const extension = from.url ? extname(new URL(from.url).pathname) || '.jpg' : '.jpg'
  const path = join(cache, key + extension)
  if (await exists(path)) return path
  const url = from.url ?? await commonsUrl(from.commons)
  const response = await fetch(url, { headers: { 'User-Agent': userAgent } })
  if (!response.ok) throw new Error(`${key}: ${response.status} ${url}`)
  await writeFile(path, Buffer.from(await response.arrayBuffer()))
  return path
}

for (const painting of data.paintings) {
  const input = await source(painting.number, painting.source)
  // Light mount around a scanned print (Kahlo) is not part of the painting.
  const base = painting.source.trim ? await sharp(input).trim({ threshold: 40 }).toBuffer() : await readFile(input)
  const meta = await sharp(base).metadata()
  for (const size of [1024, 2048]) {
    await sharp(base).rotate()
      .resize(size, size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 })
      .toFile(join(paintingsOut, `${painting.image}-${size}.webp`))
  }
  const tiny = await sharp(base).resize(32, 32, { fit: 'inside' }).webp({ quality: 40 }).toBuffer()
  painting.aspect = Number((meta.width / meta.height).toFixed(4))
  painting.placeholder = 'data:image/webp;base64,' + tiny.toString('base64')
  console.log(painting.number, painting.title, `${meta.width}×${meta.height}`)

  // Background of its own section: the same painting, soft, dark and a little desaturated. Baked into the file,
  // so phones need no CSS filters; small, because the blur hides any detail anyway.
  const background = join(backgroundsOut, painting.image + '.webp')
  await sharp(base).rotate()
    .resize(480, 480, { fit: 'inside' })
    .blur(14)
    .modulate({ saturation: 0.85 })
    // About 30% of the picture over «Ночь» #0B0A09: the text stays readable even over a light painting.
    .linear([0.3, 0.3, 0.3], [8, 7, 6])
    .webp({ quality: 70, effort: 6 })
    .toFile(background)
  const { size } = await stat(background)
  if (size > 150 * 1024) throw new Error(`${painting.image}: background ${Math.round(size / 1024)} KB, over 150 KB`)
}

// Link preview (VK, Telegram): «Крик» on «Ночь», 1200×630 JPEG.
const scream = data.paintings.find(painting => painting.slug === 'krik')
const screamImage = await sharp(join(paintingsOut, `${scream.image}-1024.webp`)).resize(560, 560, { fit: 'inside' }).toBuffer()
await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#0B0A09' } })
  .composite([{ input: screamImage, gravity: 'center' }])
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(join(root, 'public/og-canvas.jpg'))

// The site's header logo (web/public/media/logo.webp, 900px) at the size the bar shows it: 85 KB → a few KB.
await sharp(join(root, '../web/public/media/logo.webp')).resize(156, 156).webp({ quality: 90, alphaQuality: 90 }).toFile(join(root, 'public/logo.webp'))

const fonts = join(root, '../node_modules/@fontsource/manrope/files')
for (const name of ['manrope-cyrillic-400-normal.woff2', 'manrope-latin-400-normal.woff2', 'manrope-cyrillic-600-normal.woff2', 'manrope-latin-600-normal.woff2']) {
  await copyFile(join(fonts, name), join(fontsOut, name))
}
await writeFile(dataPath, JSON.stringify(data, null, 2) + '\n')
