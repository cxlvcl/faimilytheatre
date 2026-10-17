import { test } from 'node:test';
import assert from 'node:assert/strict';

// Read-only HTTP audit, not a browser or a production test.
const base = 'http://127.0.0.1:8080';
async function get(path) {
  const response = await fetch(base + path, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  return { response, body: await response.text() };
}
async function api(path) {
  const { response, body } = await get('/api' + path);
  assert.equal(response.status, 200, path);
  const envelope = JSON.parse(body);
  assert.equal(envelope.success, true, path);
  return envelope.data;
}
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#039;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

test('Every public page returns visible content, unique metadata and valid JSON-LD without JS', async () => {
  const shows = await api('/public/performances');
  const paths = ['/', '/repertoire', '/afisha', '/faq', '/franchise', ...shows.map(show => '/repertoire/' + show.slug)];
  const titles = new Set(), descriptions = new Set();
  for (const path of paths) {
    const { response, body } = await get(path);
    assert.equal(response.status, 200, path);
    assert.equal((body.match(/<h1\b/g) ?? []).length, 1, `${path}: one H1`);
    const meta = await api('/public/seo?path=' + encodeURIComponent(path));
    assert.ok(body.includes('<title>' + escape(meta.title) + '</title>'), `${path}: server/client title matches`);
    assert.ok(body.includes('name="description" content="' + escape(meta.description) + '"'), `${path}: description`);
    assert.ok(body.includes('rel="canonical" href="' + escape(meta.canonical) + '"'), `${path}: canonical`);
    assert.ok(body.includes('property="og:image"'), `${path}: social image`);
    assert.ok(!titles.has(meta.title), `${path}: unique title`);
    assert.ok(!descriptions.has(meta.description), `${path}: unique description`);
    titles.add(meta.title); descriptions.add(meta.description);
    const schema = JSON.parse(body.match(/<script type="application\/ld\+json" id="page-schema">([^]*?)<\/script>/)[1]);
    assert.equal(schema['@context'], 'https://schema.org');
    assert.equal(schema['@graph'][0]['@type'], 'TheaterGroup');
    if (path !== '/') assert.ok(schema['@graph'].some(item => item['@type'] === 'BreadcrumbList'), `${path}: breadcrumbs`);
    assert.ok(body.includes('noindex'), 'Local preview must not be indexed');
    if (path.startsWith('/repertoire/')) {
      const show = await api('/public/performances/' + path.split('/').pop());
      assert.ok(body.includes(escape(show.title)), `${path}: real show title`);
      assert.ok(body.includes('performance-paper__text'), `${path}: description in server HTML`);
      assert.ok(body.includes('Ближайшие показы'), `${path}: related dates`);
    }
  }
  console.log(`Audited ${paths.length} public pages (${shows.length} performances) through local HTTP.`);
});

test('Unknown pages return real 404/noindex and normalized public URLs redirect once', async () => {
  for (const path of ['/non-existent-audit-page', '/repertoire/non-existent-audit-performance']) {
    const { response, body } = await get(path);
    assert.equal(response.status, 404, path);
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    assert.ok(!body.includes('rel="canonical"'));
    assert.ok(body.includes('Страница не найдена'));
  }
  const normalized = await get('/REPERTOIRE/');
  assert.equal(normalized.response.status, 301);
  assert.equal(normalized.response.headers.get('location'), '/repertoire');
  const tracked = await get('/repertoire?utm_source=audit');
  assert.equal(tracked.response.status, 200);
  assert.match(tracked.body, /rel="canonical" href="[^"?]+\/repertoire"/);
});

test('Sitemap lists every real page, excludes technical URLs, and robots protects preview', async () => {
  const shows = await api('/public/performances');
  const articles = await api('/public/articles');
  const sitemap = await get('/sitemap.xml');
  assert.equal(sitemap.response.status, 200);
  const urls = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.equal(urls.length, shows.length + articles.length + 6);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every(url => !/\/(admin|api|auth|preview)(\/|$)/.test(new URL(url).pathname)));
  for (const show of shows) assert.ok(urls.some(url => url.endsWith('/repertoire/' + show.slug)));
  for (const article of articles) assert.ok(urls.some(url => url.endsWith('/articles/' + article.slug)));
  const robots = await get('/robots.txt');
  assert.equal(robots.response.status, 200);
  assert.match(robots.body, /^Disallow: \/$/m);
  assert.match(robots.body, /Disallow: \/admin/);
  assert.match(robots.body, /Sitemap: http[^\s]+\/sitemap.xml/);
});

test('Video hero, centred logo, About copy and unconditional legal details are present', async () => {
  const { body } = await get('/');
  assert.ok(body.includes('<video'));
  assert.ok(body.includes('/media/hero-2026-desktop-poster.webp') && body.includes('/media/hero-2026-mobile-poster.webp'));
  assert.ok(body.includes('/media/hero-center-logo.webp'));
  assert.ok(!body.includes('hero__slogan'));
  assert.ok(body.includes('Театр Музыки и Песка — истории, рассказанные музыкой, словом и песком'));
  assert.ok(body.includes('единственный в Нижегородской области проект'));
  assert.ok(body.includes('искусство, которое видят сердцем'));
  assert.ok(!body.includes('about-team.webp'));
  assert.match(body, /class="site-footer__legal"(?![^>]*data-reveal)/);
  assert.match(body, /<div data-reveal="true" class="site-footer__logo-reveal"><img class="site-footer__logo"[^>]*><\/div>/);
  for (const path of ['/media/hero-2026-desktop-poster.webp', '/media/hero-2026-mobile-poster.webp', '/media/hero-center-logo.webp', '/media/contact-logo.webp', '/media/lettering/about.svg', '/favicon.ico']) {
    const resource = await get(path);
    assert.equal(resource.response.status, 200, path);
    assert.match(resource.response.headers.get('content-type'), /^image\//, path);
  }
  for (const path of ['/media/hero-2026-desktop.mp4', '/media/hero-2026-desktop-1280.mp4', '/media/hero-2026-mobile.mp4']) {
    const resource = await get(path);
    assert.equal(resource.response.status, 200, path);
    assert.match(resource.response.headers.get('content-type'), /^video\/mp4/, path);
  }
});

test('Articles list and article pages render on the server with Article schema', async () => {
  const articles = await api('/public/articles');
  const list = await get('/articles');
  assert.equal(list.response.status, 200);
  assert.match(list.body, /<h1>Статьи<\/h1>/);
  for (const article of articles) assert.ok(list.body.includes('/articles/' + article.slug));
  if (articles.length) {
    const page = await get('/articles/' + articles[0].slug);
    assert.equal(page.response.status, 200);
    assert.ok(page.body.includes('"@type":"Article"'));
    assert.match(page.body, /class="article-detail__body"/);
  }
  assert.equal((await get('/articles/no-such-article')).response.status, 404);
});

test('Event schemas follow the owner spec and never invent a price or an address', async () => {
  const events = await api('/public/events');
  const meta = await api('/public/seo?path=%2Fafisha');
  const schemas = meta.schema['@graph'].filter(item => item['@type'] === 'TheaterEvent');
  assert.equal(schemas.length, events.length);
  for (const event of events) {
    const item = schemas.find(schema => schema['@id'].endsWith('#event-' + event.id));
    assert.ok(item);
    assert.equal(item.name, event.performance.title.replace(/^[«"]+|[»"]+$/g, ''));
    assert.equal(item.location.name, event.venue);
    assert.equal(item.startDate, event.event_date + (event.event_time ? 'T' + event.event_time + ':00+03:00' : ''));
    assert.equal(item.eventStatus, event.is_cancelled ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled');
    assert.equal(item.offers.url, event.ticket_url);
    // Price only from «Цена от»; no price field -> no price in the markup.
    const price = event.performance.details?.price_from;
    assert.equal(item.offers.price, price == null ? undefined : String(price));
    assert.ok(item.url.includes('/repertoire/' + event.performance.slug));
  }
});
