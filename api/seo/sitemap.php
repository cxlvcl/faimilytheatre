<?php
declare(strict_types=1);

use Theatre\Core\SeoStore;

$bootstrap = getenv('THEATRE_API_BOOTSTRAP') ?: dirname(__DIR__) . '/bootstrap.php';
$app = require $bootstrap;
$base = rtrim((string) $app->config['base_url'], '/');
$pdo = $app->db()->pdo();
$store = new SeoStore($pdo);
// Pages marked «Не индексировать» are left out.
$hidden = ['page' => array_flip($store->noindexKeys('page')), 'performance' => array_flip($store->noindexKeys('performance')), 'article' => array_flip($store->noindexKeys('article'))];
$pageDates = array_map(static fn (array $meta): ?string => $meta['updated_at'], $store->metaMap('page'));
$urls = [];
foreach (array_keys(\Theatre\Core\Seo::ROUTES) as $path) {
    if (isset($hidden['page'][$path])) continue;
    $urls[] = [$path, $pageDates[$path] ?? null];
}
foreach ($pdo->query('SELECT id, slug, updated_at FROM performances ORDER BY sort_order, id')->fetchAll() as $row) {
    if (isset($hidden['performance'][(string) $row['id']])) continue;
    $urls[] = ['/repertoire/' . $row['slug'], (string) $row['updated_at']];
}
// Articles: lastmod is the editor's «Дата обновления», otherwise the publication date.
$details = $store->articleDetailsMap();
$articles = $pdo->query("SELECT id, slug, published_on FROM articles WHERE is_published = 1 AND published_on <= CURDATE() ORDER BY published_on DESC")->fetchAll();
foreach ($articles as $row) {
    if (isset($hidden['article'][(string) $row['id']])) continue;
    $urls[] = ['/articles/' . $row['slug'], $details[(int) $row['id']]['updated_on'] ?? (string) $row['published_on']];
}

header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: public, max-age=300');
echo '<?xml version="1.0" encoding="UTF-8"?>' . PHP_EOL;
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . PHP_EOL;
foreach ($urls as [$path, $date]) {
    $url = htmlspecialchars($base . $path, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    $lastModified = $date ? '<lastmod>' . (new DateTimeImmutable($date, new DateTimeZone('UTC')))->format('Y-m-d') . '</lastmod>' : '';
    echo "  <url><loc>{$url}</loc>{$lastModified}</url>" . PHP_EOL;
}
echo '</urlset>';
