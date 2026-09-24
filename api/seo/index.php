<?php
declare(strict_types=1);

$bootstrapCandidates = array_filter([
    getenv('THEATRE_API_BOOTSTRAP') ?: null,
    dirname(__DIR__) . '/bootstrap.php',
    __DIR__ . '/api/bootstrap.php',
]);
$bootstrap = null;
foreach ($bootstrapCandidates as $candidate) {
    if (is_file($candidate)) {
        $bootstrap = $candidate;
        break;
    }
}
if ($bootstrap === null) {
    http_response_code(500);
    exit('Application is not configured.');
}
$app = require $bootstrap;

$path = rawurldecode((string) (parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/'));
$path = '/' . ltrim(rtrim($path, '/'), '/');
$baseUrl = (string) $app->config['base_url'];
$title = 'Театр Музыки и Песка';
$description = 'Театр Музыки и Песка — живая музыка, художественное слово и песочная анимация.';
$ogImage = $baseUrl . '/media/hero-7e5e35cf-poster.webp';
$status = 200;
$known = ['/', '/repertoire', '/afisha', '/faq', '/franchise'];

if ($path === '/repertoire') {
    $title = 'Репертуар — Театр Музыки и Песка';
} elseif ($path === '/afisha') {
    $title = 'Афиша — Театр Музыки и Песка';
} elseif ($path === '/faq') {
    $title = 'FAQ — Театр Музыки и Песка';
} elseif ($path === '/franchise') {
    $title = 'Франшиза — Театр Музыки и Песка';
    $description = 'Откройте Театр Музыки и Песка в своём городе.';
} elseif (preg_match('#^/repertoire/([a-z0-9-]{1,180})$#', $path, $matches) === 1) {
    $statement = $app->db()->pdo()->prepare(
        'SELECT title, short_description, cover_image FROM performances WHERE slug = :slug LIMIT 1'
    );
    $statement->execute(['slug' => $matches[1]]);
    $performance = $statement->fetch();
    if (is_array($performance)) {
        $title = (string) $performance['title'] . ' — Театр Музыки и Песка';
        $description = (string) $performance['short_description'];
        $cover = (string) $performance['cover_image'];
        $ogImage = preg_match('#^https?://#i', $cover) === 1 ? $cover : $baseUrl . '/' . ltrim($cover, '/');
    } else {
        $status = 404;
        $title = 'Спектакль не найден — Театр Музыки и Песка';
        $description = 'Спектакль не найден';
    }
} elseif (!in_array($path, $known, true)) {
    $status = 404;
    $title = 'Страница не найдена — Театр Музыки и Песка';
    $description = 'Страница не найдена';
}

http_response_code($status);
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
$canonical = $baseUrl . ($path === '/' ? '/' : $path);

$manifestPath = (string) $app->config['paths']['vite_manifest'];
$manifest = is_file($manifestPath) ? json_decode((string) file_get_contents($manifestPath), true) : [];
$entry = is_array($manifest) ? ($manifest['index.html'] ?? null) : null;
if (!is_array($entry) || !isset($entry['file'])) {
    http_response_code(503);
    exit('Сайт временно недоступен');
}
$assetBase = (string) ($app->config['asset_base'] ?? '');
$script = is_array($entry) && isset($entry['file']) ? $assetBase . '/assets/' . basename((string) $entry['file']) : '/src/main.tsx';
$styles = [];
if (is_array($entry) && isset($entry['css']) && is_array($entry['css'])) {
    foreach ($entry['css'] as $css) {
        $styles[] = $assetBase . '/assets/' . basename((string) $css);
    }
}

$schema = [
    '@context' => 'https://schema.org',
    '@type' => 'PerformingGroup',
    'name' => 'Театр Музыки и Песка',
    'url' => $baseUrl,
    'email' => 'info@teatrmip-nn.ru',
    'telephone' => '+7 831 423-58-04',
    'address' => [
        '@type' => 'PostalAddress',
        'addressLocality' => 'Нижний Новгород',
        'addressCountry' => 'RU',
    ],
];

function escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
?>
<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#080808">
  <title><?= escape($title) ?></title>
  <meta name="description" content="<?= escape($description) ?>">
  <link rel="canonical" href="<?= escape($canonical) ?>">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Театр Музыки и Песка">
  <meta property="og:title" content="<?= escape($title) ?>">
  <meta property="og:description" content="<?= escape($description) ?>">
  <meta property="og:url" content="<?= escape($canonical) ?>">
  <meta property="og:image" content="<?= escape($ogImage) ?>">
  <script type="application/ld+json"><?= json_encode($schema, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG) ?></script>
<?php foreach ($styles as $style): ?>
  <link rel="stylesheet" href="<?= escape($style) ?>">
<?php endforeach; ?>
  <link rel="preload" href="/fonts/CormorantGaramond-Cyrillic.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/media/hero-7e5e35cf-poster.webp" as="image" fetchpriority="high">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="<?= escape($script) ?>"></script>
</body>
</html>
