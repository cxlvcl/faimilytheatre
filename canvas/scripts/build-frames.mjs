// Frames for /canvas: Blender builds them (canvas/blender/*.py), this script compresses them for phones.
// Run: npm run frames -w canvas [-- --preview <dir>] [slug ...]
// Needs Blender 4.5: .local-tools/blender/Blender.app (or BLENDER=/path/to/blender).
import { execFileSync } from 'node:child_process'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'

const root = resolve(import.meta.dirname, '..')
const blender = process.env.BLENDER ?? join(root, '../.local-tools/blender/Blender.app/Contents/MacOS/Blender')
const raw = join(root, '.cache/frames')
const out = join(root, 'public/frames')
const args = process.argv.slice(2)
const previewAt = args.indexOf('--preview')
const preview = previewAt >= 0 ? resolve(args[previewAt + 1]) : '-'
const slugs = args.filter((arg, index) => !arg.startsWith('--') && (previewAt < 0 || index !== previewAt + 1))

await rm(raw, { recursive: true, force: true })
for (const path of [raw, join(raw, 'matcaps'), join(out, 'textures')]) await mkdir(path, { recursive: true })
const run = (script, ...rest) => execFileSync(blender, ['-b', '--factory-startup', '-P', join(root, 'blender', script), '--', ...rest], { stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 << 20 })
  .toString().split('\n').filter(line => /^(frame|matcap) /.test(line)).forEach(line => console.log(line))

run('matcaps.py', join(raw, 'matcaps'))
run('frames.py', raw, preview, ...slugs)

// Geometry: quantised and meshopt-compressed (three.js decodes it with MeshoptDecoder).
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
for (const name of (await readdir(raw)).filter(file => file.endsWith('.glb'))) {
  const document = await io.read(join(raw, name))
  // Materials keep only their names: the page assigns the shared matcaps, ornaments and wood by name.
  for (const material of document.getRoot().listMaterials()) {
    material.setBaseColorTexture(null).setNormalTexture(null).setMetallicRoughnessTexture(null)
  }
  await document.transform(dedup(), prune({ keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'high' }))
  await io.write(join(out, name), document)
  console.log(name, Math.round((await stat(join(out, name))).size / 1024) + ' KB')
}

// Textures shared by all frames: matcaps, ornament normal maps, wood.
const textures = [
  ...['matcap-gold', 'matcap-gold-old', 'matcap-lacquer'].map(name => [join(raw, 'matcaps', name + '.png'), name, 256, false]),
  ...['acanthus', 'punch', 'ripple', 'reed', 'klimt'].map(name => [join(raw, 'textures', `ornament-${name}.png`), `ornament-${name}`, 512, true]),
  [join(root, '.cache/polyhaven/dark_wood_diff_1k.jpg'), 'wood-dark', 512, false],
  [join(root, '.cache/polyhaven/dark_wood_nor_gl_1k.jpg'), 'wood-dark-normal', 512, true],
  [join(root, '.cache/polyhaven/oak_veneer_01_diff_1k.jpg'), 'wood-oak', 512, false],
  [join(root, '.cache/polyhaven/oak_veneer_01_nor_gl_1k.jpg'), 'wood-oak-normal', 512, true],
]
for (const [source, name, size, normal] of textures) {
  await sharp(source).resize(size, size, { fit: 'inside', withoutEnlargement: true })
    .webp(normal ? { quality: 92, smartSubsample: false } : { quality: 85 })
    .toFile(join(out, 'textures', name + '.webp'))
}
console.log('textures', textures.length)
