import { cp, mkdir, readFile, writeFile, access, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'

const root = resolve(import.meta.dirname, '..')
// Use the standard hosting package, including PHP and server-rendered HTML.
const full = JSON.parse(execFileSync(process.execPath, [join(root, 'scripts/package.mjs'), '--json'], { encoding: 'utf8' }))
const manifest = JSON.parse(await readFile(join(full.privateRoot, 'manifest.json'), 'utf8'))
for (const entry of Object.values(manifest)) {
  for (const file of [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]) {
    if (file) await access(join(full.publicRoot, file))
  }
}
for (const page of ['home', 'franchise']) await access(join(full.privateRoot, 'ssr', `${page}.html`))

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const release = join(root, 'release', `REG-RU-REFRESH-${stamp}`)
const publicRoot = join(release, 'public-update')
const privateRoot = join(release, 'private-update')
const activateRoot = join(release, 'activate-update')
for (const path of [publicRoot, privateRoot, activateRoot]) await mkdir(path, { recursive: true })
for (const name of ['assets', 'fonts', 'favicon.ico', 'favicon-96.png', 'apple-touch-icon.png']) await cp(join(full.publicRoot, name), join(publicRoot, name), { recursive: true })
// Public API folder rules: they pass the Authorization header to PHP for admin sessions.
await mkdir(join(publicRoot, 'api'))
await cp(join(full.publicRoot, 'api/.htaccess'), join(publicRoot, 'api/.htaccess'))

// Only deployed media: no unused videos or original photo files.
// hero-desktop.webp stays as the default social-sharing image.
const heroVideos = ['hero-2026-desktop.mp4', 'hero-2026-desktop-1280.mp4', 'hero-2026-mobile.mp4']
const media = [
  ...heroVideos, 'hero-2026-desktop-poster.webp', 'hero-2026-mobile-poster.webp', 'hero-center-logo.webp',
  'hero-desktop.webp', 'contact-logo.webp', 'logo.webp', 'menu-prince.webp', 'menu-prince-mobile.webp',
  'franchise-swan.webp', 'franchise-masterpieces.webp', 'lettering', 'musicians', 'partners',
]
await mkdir(join(publicRoot, 'media'))
for (const name of media) await cp(join(full.publicRoot, 'media', name), join(publicRoot, 'media', name), { recursive: true })

// Install dependencies and the compatible API before switching the public page renderer.
await mkdir(join(privateRoot, 'api'))
for (const name of ['src', 'config.example.php', 'bootstrap.php', 'index.php']) {
  await cp(join(full.privateRoot, 'api', name), join(privateRoot, 'api', name), { recursive: true })
}
await cp(join(full.privateRoot, 'ssr'), join(privateRoot, 'ssr'), { recursive: true })
await cp(join(full.privateRoot, 'manifest.json'), join(activateRoot, 'manifest.json'))
await mkdir(join(activateRoot, 'api'))
await cp(join(full.privateRoot, 'api/seo'), join(activateRoot, 'api/seo'), { recursive: true })

async function files(directory, prefix = '') {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name
    if (entry.isDirectory()) result.push(...await files(join(directory, entry.name), path + '/'))
    else if (entry.isFile()) result.push(path)
    else throw new Error(`Unexpected non-file in package: ${path}`)
  }
  return result.sort()
}
const archives = [
  ['01-public-update.zip', publicRoot, ['assets', 'fonts', 'media', 'favicon.ico', 'favicon-96.png', 'apple-touch-icon.png', 'api/.htaccess']],
  ['02-private-update.zip', privateRoot, ['api/src', 'api/config.example.php', 'api/bootstrap.php', 'api/index.php', 'ssr']],
  ['03-activate-update.zip', activateRoot, ['manifest.json', 'api/seo']],
]
const inventory = {}
const checksums = []
for (const [name, directory, entries] of archives) {
  inventory[name] = await files(directory)
  for (const file of inventory[name]) {
    const allowedVideo = heroVideos.some(video => file === 'media/' + video)
    if (/(^|\/)(config\.php|uploads|database|backups|runtime|logs|\.env)(\/|$)|\.sql(?:\.|$)/i.test(file) || (/\.mp4$/i.test(file) && !allowedVideo)) throw new Error(`Forbidden update file: ${file}`)
  }
  execFileSync('zip', ['-q', '-r', join(release, name), ...entries], { cwd: directory })
  execFileSync('unzip', ['-tq', join(release, name)])
  checksums.push(`${createHash('sha256').update(await readFile(join(release, name))).digest('hex')}  ${name}`)
}
await cp(join(root, 'docs/REG-RU-REFRESH-UPDATE.md'), join(release, 'READ-ME.md'))
// Run in phpMyAdmin before unpacking: the API reads these tables. Both statements are safe to repeat.
const sql = await Promise.all(['003_articles.sql', '004_performance_categories.sql'].map(name => readFile(join(root, 'database/migrations', name), 'utf8')))
await writeFile(join(release, '00-database.sql'), sql.join('\n'))
await writeFile(join(release, 'SHA256SUMS.txt'), checksums.join('\n') + '\n')
await writeFile(join(release, 'build-info.json'), JSON.stringify({
  created: new Date().toISOString(), entry: manifest['index.html'].file,
  sourcePackage: full.release, inventory,
  installOrder: ['00-database.sql', ...archives.map(([name]) => name)],
}, null, 2) + '\n')
console.log(release)
console.log('Install 01 in the domain root; 02 then 03 in www/private, after a server backup.')
console.log('00-database.sql only creates missing tables; config.php, uploads, passwords and DNS are not changed.')
