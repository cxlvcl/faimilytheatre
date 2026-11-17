<?php
declare(strict_types=1);

use Theatre\Core\Seo;
use Theatre\Core\PageHtml;
use Theatre\Core\SeoInput;
use Theatre\Core\SeoStore;

$bootstrap = getenv('THEATRE_API_BOOTSTRAP') ?: dirname(__DIR__) . '/bootstrap.php';
$app = require $bootstrap;
$seo = new Seo($app);
$uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
$rawPath = (string) (parse_url($uri, PHP_URL_PATH) ?: '/');
$path = Seo::path($rawPath);
$store = new SeoStore($app->db()->pdo());
// Redirect table from the admin app (old Tilda addresses, changed slugs), then the optional config map.
$rule = $store->redirect($path);
if ($rule !== null) {
    header('Location: ' . $seo->absolute($rule['to_path']), true, $rule['status_code'] === 302 ? 302 : 301);
    exit;
}
$redirects = $app->config['seo']['redirects'] ?? [];
if (isset($redirects[$path]) && is_string($redirects[$path]) && str_starts_with($redirects[$path], '/') && !str_starts_with($redirects[$path], '//')) {
    header('Location: ' . $seo->absolute($redirects[$path]), true, 301);
    exit;
}
$base = rtrim((string) $app->config['base_url'], '/');
$production = ($app->config['environment'] ?? 'development') === 'production';
$host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
$expectedHost = strtolower((string) parse_url($base, PHP_URL_HOST));
$https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
$trustedProxies = $app->config['seo']['trusted_proxies'] ?? [];
if (in_array($_SERVER['REMOTE_ADDR'] ?? '', $trustedProxies, true)) $https = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
$wrongOrigin = $production && ($host !== $expectedHost || (str_starts_with($base, 'https://') && !$https));
// Booklet of «Ожившие шедевры» (QR code, ?utm_source=booklet): its own page from canvas/, not in the sitemap.
if ($path === '/canvas') {
    if ($rawPath !== $path || $wrongOrigin) {
        $query = (string) parse_url($uri, PHP_URL_QUERY);
        header('Location: ' . ($production ? $seo->absolute($path) : $path) . ($query !== '' ? '?' . $query : ''), true, 301);
        exit;
    }
    require dirname(__DIR__, 2) . '/canvas/page.php';
    exit;
}
$page = $seo->page($path);
$meta = $page['meta'];
if ($meta['status'] === 200 && ($rawPath !== $path || $wrongOrigin)) {
    header('Location: ' . ($production ? $seo->absolute($path) : $path), true, 301);
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
$settings = $store->settings();
$google = $settings['verification_google'] !== '' ? $settings['verification_google'] : (string) ($app->config['seo']['google_verification'] ?? getenv('THEATRE_GOOGLE_VERIFICATION') ?: '');
$yandex = $settings['verification_yandex'] !== '' ? $settings['verification_yandex'] : (string) ($app->config['seo']['yandex_verification'] ?? getenv('THEATRE_YANDEX_VERIFICATION') ?: '');
$vkTag = $settings['verification_vk'] !== '' ? SeoInput::metaTag($settings['verification_vk']) : null;
// Counter ids only (digits): the site writes the standard code itself.
$counters = array_filter(['ym' => $settings['metrika_id'], 'vk' => $settings['vk_pixel_id']], static fn ($id) => preg_match('/^\d{1,20}$/', $id) === 1);
function e(string $value): string { return PageHtml::e($value); }
function jsonForHtml(mixed $value): string { return (string) json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); }
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#080808">
  <link rel="icon" href="/favicon.ico" sizes="48x48" data-light="/favicon.ico" data-dark="/favicon-white-48.png">
  <link rel="icon" type="image/png" sizes="96x96" href="/favicon-black-96.png" data-light="/favicon-black-96.png" data-dark="/favicon-white-96.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-black-192.png" data-light="/favicon-black-192.png" data-dark="/favicon-white-192.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <title><?= e($meta['title']) ?></title>
  <meta name="description" content="<?= e($meta['description']) ?>">
  <meta name="robots" content="<?= e($meta['robots']) ?>">
<?php if ($meta['status'] === 200): ?>
  <link rel="canonical" href="<?= e($meta['canonical']) ?>">
<?php endif; ?>
  <meta property="og:type" content="<?= e($meta['og_type']) ?>">
  <meta property="og:site_name" content="Театр Музыки и Песка">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:title" content="<?= e($meta['og_title']) ?>">
  <meta property="og:description" content="<?= e($meta['og_description']) ?>">
  <meta property="og:url" content="<?= e($meta['canonical']) ?>">
  <meta property="og:image" content="<?= e($meta['image']) ?>">
<?php if ($meta['image_width'] && $meta['image_height']): ?>
  <meta property="og:image:width" content="<?= (int) $meta['image_width'] ?>">
  <meta property="og:image:height" content="<?= (int) $meta['image_height'] ?>">
<?php endif; ?>
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="<?= e($meta['og_title']) ?>">
  <meta name="twitter:description" content="<?= e($meta['og_description']) ?>">
  <meta name="twitter:image" content="<?= e($meta['image']) ?>">
<?php if ($path === '/'): ?>
<?php if ($google !== ''): ?>  <meta name="google-site-verification" content="<?= e($google) ?>">
<?php endif; ?>
<?php if ($yandex !== ''): ?>  <meta name="yandex-verification" content="<?= e($yandex) ?>">
<?php endif; ?>
<?php if ($vkTag !== null): ?>  <meta name="<?= e($vkTag['name']) ?>" content="<?= e($vkTag['content']) ?>">
<?php endif; ?>
<?php endif; ?>
  <script type="application/ld+json" id="page-schema"><?= jsonForHtml($meta['schema']) ?></script>
<?php foreach ($styles as $style): ?>
  <link rel="stylesheet" href="<?= e($assetBase . '/' . $style) ?>">
<?php endforeach; ?>
  <link rel="preload" href="/fonts/CormorantGaramond-Cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<?php if ($path === '/'): ?>
  <script>try { if (sessionStorage.getItem('theatre_intro_seen') !== '1' && !matchMedia('(prefers-reduced-motion: reduce)').matches) { document.documentElement.classList.add('intro-pending'); setTimeout(function () { document.documentElement.classList.remove('intro-pending'); }, 6000); } } catch (_) {}</script>
  <link rel="preload" as="image" href="/media/hero-2026-mobile-poster.webp" media="(max-width: 680px), (orientation: portrait) and (max-width: 1024px)" fetchpriority="high">
  <link rel="preload" as="image" href="/media/hero-2026-desktop-poster.webp" media="(min-width: 681px) and (orientation: landscape), (min-width: 1025px)" fetchpriority="high">
  <link rel="preload" as="image" href="/media/logo.webp?v=2525ae2f" fetchpriority="high">
  <link rel="preload" as="image" href="/media/hero-center-logo.webp" fetchpriority="high">
<?php endif; ?>
<?php if ($counters): ?>
  <script>window.__THEATRE_COUNTERS__ = <?= jsonForHtml($counters) ?>;</script>
<?php endif; ?>
<?php if ($settings['head_code'] !== ''): ?>
<?= $settings['head_code'] /* Site-wide code from «Настройки SEO»; only the administrator can edit it. */ ?>

<?php endif; ?>
</head>
<body>
  <div id="root"><?= $body ?></div>
  <noscript><nav class="server-navigation" aria-label="Разделы сайта"><a href="/">Главная</a> · <a href="/repertoire">Репертуар</a> · <a href="/afisha">Афиша</a> · <a href="/#about">О театре</a> · <a href="/#contacts">Контакты</a> · <a href="/articles">Статьи</a> · <a href="/faq">FAQ</a> · <a href="/franchise">Франшиза</a></nav></noscript>
  <script>window.__THEATRE_DATA__ = <?= jsonForHtml($data) ?>;</script>
  <script type="module" src="<?= e($script) ?>"></script>
</body>
</html>
