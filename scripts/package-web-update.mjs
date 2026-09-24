import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve, join } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const dist = join(root, 'web/dist')
const manifest = JSON.parse(await readFile(join(dist, '.vite/manifest.json'), 'utf8'))
if (!manifest['index.html']?.file) throw new Error('Missing Vite entry; build the web workspace first')
for (const entry of Object.values(manifest)) {
  for (const file of [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]) {
    if (file) await access(join(dist, file))
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const release = join(root, 'release', `REG-RU-WEB-UPDATE-${stamp}`)
const publicRoot = join(release, 'public-update')
const privateRoot = join(release, 'private-update')
await mkdir(release)
await mkdir(publicRoot)
await mkdir(privateRoot)
await cp(join(dist, 'assets'), join(publicRoot, 'assets'), { recursive: true })
await cp(join(dist, '.vite/manifest.json'), join(privateRoot, 'manifest.json'))
await cp(join(root, 'docs/REG-RU-WEB-UPDATE.md'), join(release, 'READ-ME.md'))
await writeFile(join(release, 'build-info.json'), `${JSON.stringify({
  entry: manifest['index.html'].file,
  home: manifest['src/pages/HomePage.tsx']?.file,
  css: manifest['index.html'].css,
  created: new Date().toISOString(),
}, null, 2)}\n`)
execFileSync('zip', ['-q', '-r', join(release, 'public-update.zip'), 'assets'], { cwd: publicRoot })
execFileSync('zip', ['-q', join(release, 'private-update.zip'), 'manifest.json'], { cwd: privateRoot })
console.log(release)
console.log('1. public-update.zip: extract inside the domain root, keeping old assets.')
console.log('2. private-update.zip: back up and replace only www/private/manifest.json, last.')
console.log('No database, config.php, API code, uploads, media, fonts or index files are included.')
