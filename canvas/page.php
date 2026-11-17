<?php
declare(strict_types=1);
/**
 * /canvas — digital booklet of the concert «Ожившие шедевры», opened from the QR code in the printed booklet.
 * Included by api/seo/index.php ($app, $seo, $store). All content is server HTML: the page reads without JS;
 * src/main.ts adds the 3D paintings. Content: data/paintings.json. See README.md.
 */

use Theatre\Controllers\PublicController;
use Theatre\Core\PageHtml;
use Theatre\Core\Seo;
use Theatre\Core\SeoInput;

$data = json_decode((string) file_get_contents(__DIR__ . '/data/paintings.json'), true, 512, JSON_THROW_ON_ERROR);
// Hosting keeps the manifest next to this file; a local checkout reads the Vite build directly.
$manifestFile = is_file(__DIR__ . '/manifest.json') ? __DIR__ . '/manifest.json' : __DIR__ . '/dist/.vite/manifest.json';
$manifest = is_file($manifestFile) ? json_decode((string) file_get_contents($manifestFile), true) : [];
$entry = $manifest['src/main.ts'] ?? null;
if (!is_array($entry) || !isset($entry['file'])) { http_response_code(503); exit('Страница временно недоступна'); }
$assets = '/assets/canvas/';

// The «Купить билет» button: the nearest date of this concert from the afisha; no date, no button.
$next = null;
try {
    foreach ((new PublicController($app))->events() as $event) {
        if ($event['is_cancelled'] || $event['ticket_url'] === '') continue;
        if ($event['performance']['slug'] === $data['performanceSlug'] || mb_stripos($event['performance']['title'], $data['title']) !== false) { $next = $event; break; }
    }
} catch (Throwable) {}

$settings = $store->settings();
$counters = array_filter(['ym' => $settings['metrika_id'], 'vk' => $settings['vk_pixel_id']], static fn ($id) => preg_match('/^\d{1,20}$/', $id) === 1);
$title = $data['title'] . ' — программа концерта | Театр Музыки и Песка';
$url = Seo::readableUrl($seo->absolute('/canvas'));
$months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
$e = static fn (string $value): string => PageHtml::e($value);
$json = static fn (mixed $value): string => (string) json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT);
$social = [
    ['ВКонтакте', 'https://vk.ru/lmtales', 'M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.391 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.033-1-1.49-1.135-1.744-1.135-.356 0-.458.102-.458.593v1.575c0 .424-.135.678-1.253.678-1.846 0-3.896-1.118-5.335-3.202C4.624 10.857 4.03 8.57 4.03 8.096c0-.254.102-.491.593-.491h1.744c.44 0 .61.203.78.677.863 2.49 2.303 4.675 2.896 4.675.22 0 .322-.102.322-.66V9.721c-.068-1.186-.695-1.287-.695-1.71 0-.204.17-.407.44-.407h2.744c.373 0 .508.203.508.643v3.473c0 .372.17.508.271.508.22 0 .407-.136.813-.542 1.254-1.406 2.151-3.574 2.151-3.574.119-.254.322-.491.763-.491h1.744c.525 0 .644.27.525.643-.22 1.017-2.354 4.031-2.354 4.031-.186.305-.254.44 0 .78.186.254.796.779 1.203 1.253.745.847 1.32 1.558 1.473 2.05.17.49-.085.744-.576.744z'],
    ['Telegram', 'https://t.me/dobrohot_art', 'M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z'],
];

http_response_code(200);
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cache-Control: no-cache');
header('X-Robots-Tag: noindex, follow');
?>
<!doctype html>
<html lang="ru" class="cv-nojs">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#0B0A09">
  <meta name="color-scheme" content="dark">
  <script>document.documentElement.className = 'cv-js';</script>
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" type="image/png" sizes="96x96" href="/favicon-white-96.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-white-192.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <title><?= $e($title) ?></title>
  <meta name="description" content="<?= $e($data['description']) ?>">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="<?= $e($url) ?>">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Театр Музыки и Песка">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:title" content="<?= $e($title) ?>">
  <meta property="og:description" content="<?= $e($data['description']) ?>">
  <meta property="og:url" content="<?= $e($url) ?>">
  <meta property="og:image" content="<?= $e($seo->absolute($assets . 'og-canvas.jpg')) ?>">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="preload" href="/fonts/CormorantGaramond-Cyrillic.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="<?= $assets ?>fonts/manrope-cyrillic-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<?php foreach ($entry['css'] ?? [] as $css):
    // Inlined (7 KB): no render-blocking request on a weak connection in the hall.
    $cssFile = dirname($manifestFile, is_file(__DIR__ . '/manifest.json') ? 1 : 2) . '/' . $css;
?>
<?php if (is_file($cssFile)): ?>
  <style><?= str_replace('</', '<\\/', (string) file_get_contents($cssFile)) ?></style>
<?php else: ?>
  <link rel="stylesheet" href="<?= $e($assets . $css) ?>">
<?php endif; ?>
<?php endforeach; ?>
<?php $firstImage = $assets . 'paintings/' . $data['paintings'][0]['image']; ?>
  <link rel="preload" as="image" href="<?= $e($firstImage) ?>-1024.webp" media="(max-width: 700px)" fetchpriority="high">
  <link rel="preload" as="image" imagesrcset="<?= $e($firstImage) ?>-1024.webp 1024w, <?= $e($firstImage) ?>-2048.webp 2048w" imagesizes="760px" media="(min-width: 701px)" fetchpriority="high">
  <script type="module" src="<?= $e($assets . $entry['file']) ?>"></script>
<?php if ($counters): ?>
  <script>window.__THEATRE_COUNTERS__ = <?= $json($counters) ?>;</script>
<?php endif; ?>
<?php if ($settings['head_code'] !== ''): ?>
<?= $settings['head_code'] /* Site-wide code from «Настройки SEO»; only the administrator can edit it. */ ?>

<?php endif; ?>
</head>
<body class="cv">
  <div class="cv-bg" aria-hidden="true">
<?php foreach ($data['paintings'] as $index => $painting): ?>
    <img class="cv-bg__layer" <?= $index === 0 ? 'src' : 'data-src' ?>="<?= $e($assets . 'backgrounds/' . $painting['image'] . '.webp') ?>" alt="" width="480" height="480" decoding="async">
<?php endforeach; ?>
  </div>

  <header class="cv-bar">
    <a class="cv-bar__logo" href="/" aria-label="Театр Музыки и Песка — главная"><img src="<?= $assets ?>logo.webp" alt="" width="78" height="78"></a>
  </header>

  <main class="cv-main">
    <h1 class="cv-h1"><?= $e($data['title']) ?></h1>
    <p class="cv-intro"><?= $e($data['intro']) ?></p>

<?php foreach ($data['paintings'] as $index => $painting):
    $aspect = (float) $painting['aspect'];
    // Frame width in units of the painting height (data «frames»); the stage keeps the framed proportions.
    $frame = $data['frames'][$painting['frame']] ?? ['width' => 0, 'tone' => 'none'];
    $border = $frame['width'] * min($aspect, 1.0);
    $outer = ($aspect + 2 * $border) / (1 + 2 * $border);
    $insetX = 100 * $border / ($aspect + 2 * $border);
    $insetY = 100 * $border / (1 + 2 * $border);
    $alt = $painting['title'] . ', ' . $painting['artist'] . ', ' . $painting['year'];
    $image = $assets . 'paintings/' . $painting['image'];
    $width = $aspect >= 1 ? 1024 : (int) round(1024 * $aspect);
    $height = $aspect >= 1 ? (int) round(1024 / $aspect) : 1024;
    $first = $index === 0;
?>
    <article class="cv-work" id="<?= $e($painting['slug']) ?>" data-slug="<?= $e($painting['slug']) ?>" data-frame="<?= $e($painting['frame']) ?>" data-aspect="<?= $aspect ?>" data-border="<?= round($border, 5) ?>"<?= $painting['frame'] !== 'none' ? ' data-model="' . $e($assets . 'frames/' . $painting['image'] . '.glb') . '"' : '' ?>>
      <p class="cv-work__number"><?= $e($painting['number']) ?></p>
      <h2 class="cv-work__title"><?= $e($painting['title']) ?></h2>
      <p class="cv-work__meta"><?= $e($painting['artist']) ?> · <?= $e($painting['year']) ?></p>
      <button class="cv-stage cv-stage--<?= $e($frame['tone']) ?>" type="button" aria-label="<?= $e($alt) ?>" aria-expanded="true" aria-controls="text-<?= $e($painting['slug']) ?>" style="--outer: <?= round($outer, 5) ?>; --inset-x: <?= round($insetX, 4) ?>%; --inset-y: <?= round($insetY, 4) ?>%">
        <span class="cv-stage__body">
          <picture>
            <source media="(max-width: 700px)" srcset="<?= $e($image) ?>-1024.webp">
            <img class="cv-stage__image" src="<?= $e($image) ?>-1024.webp" srcset="<?= $e($image) ?>-1024.webp 1024w, <?= $e($image) ?>-2048.webp 2048w" sizes="760px" width="<?= $width ?>" height="<?= $height ?>" alt="<?= $e($alt) ?>" draggable="false" decoding="async"<?= $first ? ' fetchpriority="high"' : ' loading="lazy"' ?> style="background-image: url(<?= $e($painting['placeholder']) ?>)">
          </picture>
        </span>
      </button>
<?php if ($first): ?>
      <p class="cv-hint">Поверните картину. Нажмите, чтобы прочитать</p>
<?php endif; ?>
      <div class="cv-text" id="text-<?= $e($painting['slug']) ?>">
        <div class="cv-text__inner">
<?php foreach ($painting['text'] as $paragraph): ?>
          <p><?= $e($paragraph) ?></p>
<?php endforeach; ?>
        </div>
      </div>
    </article>
<?php endforeach; ?>
  </main>

  <nav class="cv-links" aria-label="Театр Музыки и Песка">
<?php if ($next !== null):
    [$year, $month, $day] = array_map('intval', explode('-', $next['event_date']));
    $date = $day . ' ' . $months[$month - 1] . ($next['event_time'] ? ', ' . $next['event_time'] : '');
?>
    <p class="cv-links__date"><?= $e($date) ?><?= $next['venue'] !== '' ? ' · ' . $e($next['venue']) : '' ?></p>
    <a class="cv-links__buy" href="<?= $e($next['ticket_url']) ?>" target="_blank" rel="noopener" data-performance="<?= $e($next['performance']['slug']) ?>" data-date="<?= $e($next['event_date']) ?>">Купить билет</a>
<?php endif; ?>
    <a class="cv-links__afisha" href="/afisha">Афиша</a>
    <div class="cv-links__social">
<?php foreach ($social as [$label, $href, $icon]): ?>
      <a href="<?= $e($href) ?>" target="_blank" rel="noopener" aria-label="<?= $e($label) ?>"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false"><path fill="currentColor" d="<?= $e($icon) ?>"/></svg></a>
<?php endforeach; ?>
    </div>
  </nav>

  <footer class="cv-footer">
    <img class="cv-footer__logo" src="/media/contact-logo.webp" alt="Театр Музыки и Песка" width="800" height="800" loading="lazy" decoding="async">
    <div class="cv-footer__contacts">
      <p>Нижний Новгород</p>
      <div>
        <a href="tel:+78314235804">+7 (831) 423-58-04</a>
        <a href="tel:+79290535804">+7 (929) 053-58-04</a>
        <a href="mailto:info@teatrmip-nn.ru">info@teatrmip-nn.ru</a>
      </div>
    </div>
    <div class="cv-footer__legal">
      <p>© All Right Reserved. Театр Музыки и Песка.</p>
      <p>ИП Доброхотова Н.М. ИНН 525715626730</p>
      <p>ОГРН 316527500079224</p>
    </div>
  </footer>
</body>
</html>
