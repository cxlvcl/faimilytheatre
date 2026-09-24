import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile, readdir, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomBytes, createHash, randomUUID } from 'node:crypto'
import { gunzipSync } from 'node:zlib'

const root = resolve(import.meta.dirname, '..')
const runtime = await mkdtemp(join(tmpdir(), 'theatre-api-test-'))
const php = process.env.TEST_PHP || 'php'
const franken = process.env.TEST_FRANKENPHP
const base = 'http://127.0.0.1:8081'
const password = randomBytes(24).toString('hex')
const env = { ...process.env, TEST_RUNTIME: runtime, TEST_ADMIN_PASSWORD: password, THEATRE_CONFIG_FILE: join(runtime, 'config.php'), UPLOADS_DIR: join(runtime, 'uploads') }
let server
let token
let performanceOne
let performanceTwo
let event
let application
const phpRun = (file, extra = {}) => {
  const result = spawnSync(php, [...(php.includes('frankenphp') ? ['php-cli'] : []), file], { cwd: root, env: { ...env, ...extra }, encoding: 'utf8' })
  assert.equal(result.status, 0, `PHP failed: ${result.stderr || result.stdout}`)
  return result.stdout
}
const inspect = () => JSON.parse(phpRun('tests/db.php', { TEST_ACTION: 'inspect' }))
async function request(path, { method = 'GET', body, auth = false, status = 200 } = {}) {
  const response = await fetch(`${base}/api${path}`, { method, signal: AbortSignal.timeout(20000), headers: { ...(auth ? { Authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body) })
  const data = await response.json()
  assert.equal(response.status, status, JSON.stringify(data))
  assert.equal(data.success, status < 400)
  return data.success ? data.data : data.error
}
async function performanceForm(title = 'Тестовая история', overrides = {}) {
  const body = new FormData()
  const values = { title, short_description: 'Проверка сохранения описания спектакля.', description: 'Это **проверка** настоящего сохранения спектакля с обложкой и отдельным изображением Hero.', is_premiere: '1', ...overrides }
  for (const [key, value] of Object.entries(values)) body.set(key, value)
  body.set('cover_image', new Blob([await readFile(join(root, 'web/public/media/musicians/1.webp'))], { type: 'image/webp' }), 'cover.webp')
  body.set('hero_image', new Blob([await readFile(join(root, 'web/public/media/about.webp'))], { type: 'image/webp' }), 'hero.webp')
  if (process.env.TEST_UPLOAD_IMAGE) {
    const image = await readFile(process.env.TEST_UPLOAD_IMAGE)
    for (const key of ['cover_image', 'hero_image']) body.set(key, new Blob([image], { type: 'image/png' }), 'owner-image.png')
  }
  return body
}
before(async () => {
  if (!franken) throw new Error('Set TEST_FRANKENPHP and TEST_PHP; disposable MySQL database theatre_test required.')
  phpRun('tests/core.php')
  phpRun('tests/db.php')
  const config = join(runtime, 'Caddyfile')
  await writeFile(config, `{\n admin off\n auto_https off\n frankenphp {\n php_ini upload_max_filesize 16M\n php_ini post_max_size 40M\n php_ini memory_limit 256M\n }\n}\nhttp://127.0.0.1:8081 {\n bind 127.0.0.1\n root * ${root}\n php_server {\n try_files /scripts/dev-router.php\n }\n}\n`)
  server = spawn(franken, ['run', '--config', config], { env, cwd: root, stdio: ['ignore','ignore','pipe'] })
  let errors = ''
  server.stderr.on('data', chunk => { errors += chunk })
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await fetch(`${base}/api/public/faq`, { signal: AbortSignal.timeout(2000) }); await response.arrayBuffer(); if (response.ok) return } catch { /* starting */ }
    if (server.exitCode !== null) throw new Error(errors)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`Test server did not start: ${errors}`)
})
after(async () => { server?.kill('SIGTERM'); console.log(`Isolated test artifacts: ${runtime}`) })

test('End-to-end PHP / MySQL contract', async t => {
  await t.test('Empty content, exact FAQ, unknown performance and auth boundary', async () => {
    assert.deepEqual(await request('/public/performances'), [])
    assert.deepEqual(await request('/public/events'), [])
    const faq = await request('/public/faq'); assert.equal(faq.length, 5); assert.equal(faq[0].question, 'Сколько длится спектакль?')
    await request('/public/performances/missing', { status: 404 })
    await request('/admin/performances', { status: 401 })
    const invalid = await request('/admin/auth/login', { method: 'POST', body: { login: 'test-admin', password: 'wrong' }, status: 401 }); assert.equal(invalid.message, 'Неверный логин или пароль')
    const login = await request('/admin/auth/login', { method: 'POST', body: { login: 'test-admin', password } }); token = login.token
    assert.equal((await request('/admin/auth/me', { auth: true })).admin.login, 'test-admin')
    const stored = inspect().tokens[0]; assert.equal(stored.token_hash, createHash('sha256').update(token).digest('hex')); assert.ok(!JSON.stringify(stored).includes(token)); assert.ok(new Date(stored.expires_at) - new Date(stored.created_at) <= 30 * 86400000)
  })
  await t.test('Validation and real image uploads, default focal points, duplicate stable slugs', async () => {
    await request('/admin/performances', { method: 'POST', auth: true, body: { title: [] }, status: 422 })
    performanceOne = await request('/admin/performances', { method: 'POST', auth: true, body: await performanceForm(), status: 201 })
    performanceTwo = await request('/admin/performances', { method: 'POST', auth: true, body: await performanceForm(), status: 201 })
    assert.equal(performanceTwo.slug, `${performanceOne.slug}-2`); assert.equal(performanceOne.hero_focus_mobile_x, 50)
    const update = await performanceForm('Новое название'); update.delete('cover_image'); update.delete('hero_image'); update.set('_method', 'PUT'); update.set('hero_focus_mobile_x', '20')
    const edited = await request(`/admin/performances/${performanceOne.id}`, { method: 'POST', auth: true, body: update }); assert.equal(edited.slug, performanceOne.slug); assert.equal(edited.hero_focus_mobile_x, 20); assert.equal(edited.cover_image, performanceOne.cover_image)
    const images = inspect().images; assert.equal(images.length, 4); assert.ok(images.every(image => image.mime === 'image/webp' && Math.max(image.width,image.height) <= 2560))
    const response = await fetch(`${base}${edited.cover_image}`); assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /image\/webp/)
  })
  await t.test('Safe media replacement and atomic ordering', async () => {
    const bad = new FormData(); bad.set('image', new Blob(['<?php echo 1; ?>'], { type: 'image/png' }), 'fake.png')
    await request(`/admin/performances/${performanceOne.id}/cover`, { method: 'POST', auth: true, body: bad, status: 422 }); assert.equal((await request(`/public/performances/${performanceOne.slug}`)).cover_image, performanceOne.cover_image)
    const good = new FormData(); good.set('image', new Blob([await readFile(join(root, 'web/public/media/about.webp'))], { type: 'image/webp' }), 'replacement.webp')
    const replaced = await request(`/admin/performances/${performanceOne.id}/cover`, { method: 'POST', auth: true, body: good }); assert.notEqual(replaced.cover_image, performanceOne.cover_image)
    await assert.rejects(access(join(runtime, performanceOne.cover_image)))
    await request('/admin/performances/reorder', { method: 'POST', auth: true, body: { ids: [performanceTwo.id,performanceOne.id] } }); assert.equal((await request('/public/performances'))[0].id,performanceTwo.id)
    await request('/admin/performances/reorder', { method: 'POST', auth: true, body: { ids: [performanceOne.id] }, status: 409 })
  })
  await t.test('Events without a start time stay compatible; tickets and foreign keys work', async () => {
    const body = new FormData(); for (const [key,value] of Object.entries({ performance_id: String(performanceOne.id), event_date: '2099-01-01', venue: 'Тестовая площадка', ticket_url: 'https://example.com/tickets?a=1' })) body.set(key,value)
    body.set('poster_image', new Blob([await readFile(join(root, 'web/public/media/musicians/2.webp'))], { type: 'image/webp' }), 'poster.webp')
    event = await request('/admin/events', { method: 'POST', auth: true, body, status: 201 })
    body.set('event_date','2020-01-01'); await request('/admin/events', { method: 'POST', auth: true, body, status: 422 })
    await request(`/admin/performances/${performanceOne.id}`, { method: 'DELETE', auth: true, status: 409 })
    const events = await request('/public/events'); assert.equal(events.length,1); assert.equal(events[0].ticket_url,'https://example.com/tickets?a=1'); assert.equal(events[0].event_time, null)
    await request('/public/analytics/ticket-click',{ method:'POST', body:{event_id:event.id,visitor_id:randomUUID()},status:201 })
  })
  await t.test('Start time saves, edits, clears and validates without timezone conversion', async () => {
    const body = { performance_id: performanceOne.id, event_date: '2099-01-01', venue: 'Тестовая площадка', ticket_url: 'https://example.com/tickets?a=1' }
    for (const value of ['00:00', '09:05', '18:30', '23:59']) {
      const edited = await request(`/admin/events/${event.id}`, { method: 'PUT', auth: true, body: { ...body, event_time: value } })
      assert.equal(edited.event_time, value)
      assert.equal((await request('/admin/events', { auth: true }))[0].event_time, value)
      assert.equal((await request('/public/events'))[0].event_time, value)
    }
    // A previous admin build must not erase the time by omitting the new field.
    assert.equal((await request(`/admin/events/${event.id}`, { method: 'PUT', auth: true, body })).event_time, '23:59')
    for (const event_time of ['24:00', '12:99', '9:30', '18:30:00', [], 1234]) {
      const error = await request(`/admin/events/${event.id}`, { method: 'PUT', auth: true, body: { ...body, event_time }, status: 422 })
      assert.ok(error.fields.event_time)
    }
    assert.equal((await request('/public/events'))[0].event_time, '23:59')
    for (const event_time of ['', null]) assert.equal((await request(`/admin/events/${event.id}`, { method: 'PUT', auth: true, body: { ...body, event_time } })).event_time, null)
    assert.equal((await request('/public/events'))[0].event_time, null)
    // Running migrations again cannot reset saved content.
    const before = await request('/admin/events', { auth: true })
    phpRun('tests/db.php', { TEST_ACTION: 'migrate' })
    phpRun('tests/db.php', { TEST_ACTION: 'migrate' })
    assert.deepEqual(await request('/admin/events', { auth: true }), before)
  })
  await t.test('Multipart creation persists time and same-day performances sort by start time', async () => {
    const created = []
    for (const event_time of ['18:30', '10:00']) {
      const body = new FormData()
      for (const [key, value] of Object.entries({ performance_id: String(performanceOne.id), event_date: '2099-01-01', event_time, venue: 'Тестовая площадка', ticket_url: 'https://example.com/tickets' })) body.set(key, value)
      body.set('poster_image', new Blob([await readFile(join(root, 'web/public/media/musicians/2.webp'))], { type: 'image/webp' }), 'poster.webp')
      const item = await request('/admin/events', { method: 'POST', auth: true, body, status: 201 })
      assert.equal(item.event_time, event_time)
      created.push(item)
    }
    for (const route of ['/public/events', '/admin/events']) {
      const rows = await request(route, { auth: route.startsWith('/admin') })
      assert.deepEqual(rows.map(item => item.event_time), ['10:00', '18:30', null])
    }
    for (const item of created) await request(`/admin/events/${item.id}`, { method: 'DELETE', auth: true })
  })
  await t.test('FAQ CRUD, restricted Markdown and transactional reorder', async () => {
    await request('/admin/faq',{method:'POST',auth:true,body:{question:'Проверка?',answer:'* Запрещённый список'},status:422})
    const faq = await request('/admin/faq',{method:'POST',auth:true,body:{question:'Тестовый вопрос?',answer:'Ответ **жирным** и *курсивом*.'},status:201})
    await request(`/admin/faq/${faq.id}`,{method:'PUT',auth:true,body:{question:'Изменённый вопрос?',answer:'Сохранённый **ответ** с абзацем.'}})
    const items = await request('/admin/faq',{auth:true}); await request('/admin/faq/reorder',{method:'POST',auth:true,body:{ids:items.map(item=>item.id).reverse()}}); assert.equal((await request('/public/faq'))[0].id,faq.id)
    await request(`/admin/faq/${faq.id}`,{method:'DELETE',auth:true}); assert.equal((await request('/public/faq')).length,5)
  })
  await t.test('Applications persist, normalize phones, status both ways and anti-spam', async () => {
    await request('/public/franchise/applications',{method:'POST',body:{name:'Тест',city:'Москва',phone:'8 (929) 111-22-33',website:'spam'},status:422})
    application = await request('/public/franchise/applications',{method:'POST',body:{name:'Тест',city:'Москва',phone:'8 (929) 111-22-33',website:''},status:201})
    assert.equal(inspect().phone,'+79291112233'); assert.equal((await request('/admin/franchise/new-count',{auth:true})).count,1)
    for(const status of ['processed','new']) await request(`/admin/franchise/applications/${application.id}/status`,{method:'PATCH',auth:true,body:{status}})
    for(let i=0;i<2;i++) await request('/public/franchise/applications',{method:'POST',body:{name:'X',city:'X',phone:'bad'},status:422})
    const error = await request('/public/franchise/applications',{method:'POST',body:{},status:429}); assert.equal(error.message,'Слишком много попыток. Попробуйте немного позже.')
  })
  await t.test('Privacy-safe unique daily analytics, date periods, SEO real statuses and assets', async () => {
    const visitor = randomUUID()
    for(const path of ['/franchise?utm_source=test','/franchise','/']) await request('/public/analytics/page-view',{method:'POST',body:{page_path:path,visitor_id:visitor},status:201})
    const db=inspect(); assert.equal(db.daily_visitors,1); assert.equal(db.page_views,3); assert.notEqual(db.visitor_hash,visitor)
    const stats=await request('/admin/statistics',{auth:true}); assert.equal(stats.visitors.today.value,1); assert.equal(stats.page_views.today.value,3); assert.equal(stats.ticket_clicks.today.value,1); assert.equal(stats.daily.length,30)
    assert.equal((await request('/admin/franchise/statistics',{auth:true})).views.today,2)
    const shell=await fetch(`${base}/repertoire/${performanceOne.slug}`); assert.equal(shell.status,200); const html=await shell.text(); assert.match(html, /Новое название/); assert.match(html, /application\/ld\+json/); assert.ok(!html.includes('/src/main.tsx'))
    const script=html.match(/<script type="module" src="([^"]+)/)[1]; assert.equal((await fetch(`${base}${script}`)).status,200)
    assert.equal((await fetch(`${base}/missing-route`)).status,404); assert.equal((await fetch(`${base}/repertoire/missing`)).status,404)
    assert.match(await (await fetch(`${base}/sitemap.xml`)).text(),new RegExp(performanceOne.slug)); assert.match(await (await fetch(`${base}/robots.txt`)).text(),/Sitemap:/)
  })
  await t.test('Maintenance retains applications/media, backup includes uploads; past events hidden', async () => {
    phpRun('tests/db.php',{TEST_ACTION:'age'}); assert.deepEqual(await request('/public/events'),[])
    const before=inspect(); phpRun('cron/daily.php'); const after=inspect(); assert.equal(after.page_views,before.page_views-1); assert.equal(after.franchise_applications,1); assert.equal(after.images.length,before.images.length)
    phpRun('tests/db.php',{TEST_ACTION:'backup'})
    const backups=await readdir(join(runtime,'backups')); assert.ok(backups.some(name=>name.startsWith('weekly-')))
    const dump=gunzipSync(await readFile(join(runtime,'backups',backups.find(name=>name.endsWith('.sql.gz'))))).toString(); assert.match(dump,/CREATE TABLE `franchise_applications`/)
  })
  await t.test('Entity deletion, token revocation, login failure rate limit', async () => {
    await request(`/admin/events/${event.id}`,{method:'DELETE',auth:true}); await request(`/admin/performances/${performanceOne.id}`,{method:'DELETE',auth:true}); await request(`/admin/performances/${performanceTwo.id}`,{method:'DELETE',auth:true})
    await request(`/admin/franchise/applications/${application.id}`,{method:'DELETE',auth:true}); assert.equal(inspect().images.length,0)
    await request('/admin/auth/logout',{method:'POST',auth:true}); await request('/admin/auth/me',{auth:true,status:401}); assert.equal(inspect().admin_tokens,0)
    for(let i=0;i<5;i++) await request('/admin/auth/login',{method:'POST',body:{login:'test-admin',password:'wrong'},status:i===4?429:401})
    await request('/admin/auth/login',{method:'POST',body:{login:'test-admin',password},status:429})
  })
})
