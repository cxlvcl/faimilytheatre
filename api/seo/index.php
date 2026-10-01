<?php
declare(strict_types=1);

use Theatre\Core\Seo;
use Theatre\Core\PageHtml;

$bootstrap = getenv('THEATRE_API_BOOTSTRAP') ?: dirname(__DIR__) . '/bootstrap.php';
$app = require $bootstrap;
$seo = new Seo($app);
$uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
$rawPath = (string) (parse_url($uri, PHP_URL_PATH) ?: '/');
$path = Seo::path($rawPath);
// Optional explicit old-slug map. No guessed or blanket redirects.
$redirects = $app->config['seo']['redirects'] ?? [];
if (isset($redirects[$path]) && is_string($redirects[$path]) && str_starts_with($redirects[$path], '/') && !str_starts_with($redirects[$path], '//')) {
    header('Location: ' . $seo->absolute($redirects[$path]), true, 301);
    exit;
}
$page = $seo->page($path);
$meta = $page['meta'];
$base = rtrim((string) $app->config['base_url'], '/');
$production = ($app->config['environment'] ?? 'development') === 'production';
$host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
$expectedHost = strtolower((string) parse_url($base, PHP_URL_HOST));
$https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
$trustedProxies = $app->config['seo']['trusted_proxies'] ?? [];
if (in_array($_SERVER['REMOTE_ADDR'] ?? '', $trustedProxies, true)) $https = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
$wrongOrigin = $production && ($host !== $expectedHost || (str_starts_with($base, 'https://') && !$https));
if ($meta['status'] === 200 && ($rawPath !== $path || $wrongOrigin)) {
    header('Location: ' . ($production ? $meta['canonical'] : $path), true, 301);
    exit;
}
http_response_code($meta['status']);
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cache-Control: no-cache');
if (str_starts_with($meta['robots'], 'noindex')) header('X-Robots-Tag: ' . $meta['robots']);

$manifestPath = (string) $app->config['paths']['vite_manifest'];
$manifest = is_file($manifestPath) ? json_decode((string) file_get_contents($manifestPath), true) : [];
$entry = $manifest['index.html'] ?? null;
if (!is_array($entry) || !isset($entry['file'])) { http_response_code(503); exit('Сайт временно недоступен'); }
$assetBase = (string) ($app->config['asset_base'] ?? '');
$script = $assetBase . '/' . $entry['file'];
$styles = $entry['css'] ?? [];
// Static fragments also need the corresponding split CSS on their first paint.
$routeChunk = $path === '/' ? 'src/pages/HomePage.tsx' : ($path === '/franchise' ? 'src/pages/FranchisePage.tsx' : '');
foreach ($manifest[$routeChunk]['css'] ?? [] as $css) $styles[] = $css;
$styles = array_unique($styles);
$body = PageHtml::render($page, $manifestPath);
$data = $page['data'];
$data['/public/seo?path=' . rawurlencode($path)] = $meta;
$google = (string) ($app->config['seo']['google_verification'] ?? getenv('THEATRE_GOOGLE_VERIFICATION') ?: '');
$yandex = (string) ($app->config['seo']['yandex_verification'] ?? getenv('THEATRE_YANDEX_VERIFICATION') ?: '');
function e(string $value): string { return PageHtml::e($value); }
function jsonForHtml(mixed $value): string { return (string) json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); }
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#080808">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" href="/favicon-96.png" type="image/png" sizes="96x96">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <title><?= e($meta['title']) ?></title>
  <meta name="description" content="<?= e($meta['description']) ?>">
  <meta name="robots" content="<?= e($meta['robots']) ?>">
<?php if ($meta['status'] === 200): ?>
  <link rel="canonical" href="<?= e($meta['canonical']) ?>">
<?php endif; ?>
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Театр Музыки и Песка">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:title" content="<?= e($meta['title']) ?>">
  <meta property="og:description" content="<?= e($meta['description']) ?>">
  <meta property="og:url" content="<?= e($meta['canonical']) ?>">
  <meta property="og:image" content="<?= e($meta['image']) ?>">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="<?= e($meta['title']) ?>">
  <meta name="twitter:description" content="<?= e($meta['description']) ?>">
  <meta name="twitter:image" content="<?= e($meta['image']) ?>">
<?php if ($google !== ''): ?><meta name="google-site-verification" content="<?= e($google) ?>"><?php endif; ?>
<?php if ($yandex !== ''): ?><meta name="yandex-verification" content="<?= e($yandex) ?>"><?php endif; ?>
  <script type="application/ld+json" id="page-schema"><?= jsonForHtml($meta['schema']) ?></script>
<?php foreach ($styles as $style): ?>
  <link rel="stylesheet" href="<?= e($assetBase . '/' . $style) ?>">
<?php endforeach; ?>
  <link rel="preload" href="/fonts/CormorantGaramond-Cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<?php if ($path === '/'): ?>
  <script>try { if (sessionStorage.getItem('theatre_intro_seen') !== '1' && !matchMedia('(prefers-reduced-motion: reduce)').matches) { document.documentElement.classList.add('intro-pending'); setTimeout(function () { document.documentElement.classList.remove('intro-pending'); }, 6000); } } catch (_) {}</script>
  <link rel="preload" as="image" href="/media/hero-2026-mobile-poster.webp" media="(max-width: 680px), (orientation: portrait) and (max-width: 1024px)" fetchpriority="high">
  <link rel="preload" as="image" href="/media/hero-2026-desktop-poster.webp" media="(min-width: 681px) and (orientation: landscape), (min-width: 1025px)" fetchpriority="high">
  <link rel="preload" as="image" href="/media/hero-center-logo.webp" fetchpriority="high">
<?php endif; ?>
</head>
<body>
  <div id="root"><?= $body ?></div>
  <noscript><nav class="server-navigation" aria-label="Разделы сайта"><a href="/">Главная</a> · <a href="/repertoire">Репертуар</a> · <a href="/afisha">Афиша</a> · <a href="/#about">О театре</a> · <a href="/#contacts">Контакты</a> · <a href="/articles">Статьи</a> · <a href="/faq">FAQ</a> · <a href="/franchise">Франшиза</a></nav></noscript>
  <script>window.__THEATRE_DATA__ = <?= jsonForHtml($data) ?>;</script>
  <script type="module" src="<?= e($script) ?>"></script>
</body>
</html>
