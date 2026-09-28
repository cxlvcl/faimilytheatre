<?php
declare(strict_types=1);

$bootstrap = getenv('THEATRE_API_BOOTSTRAP') ?: dirname(__DIR__) . '/bootstrap.php';
$app = require $bootstrap;
$base = rtrim((string) $app->config['base_url'], '/');
$staticPaths = array_keys(\Theatre\Core\Seo::ROUTES);
$rows = $app->db()->pdo()->query('SELECT slug, updated_at FROM performances ORDER BY id')->fetchAll();

header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: public, max-age=300');
echo '<?xml version="1.0" encoding="UTF-8"?>' . PHP_EOL;
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . PHP_EOL;
foreach ($staticPaths as $path) {
    $url = htmlspecialchars($base . $path, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    echo "  <url><loc>{$url}</loc></url>" . PHP_EOL;
}
foreach ($rows as $row) {
    $url = htmlspecialchars($base . '/repertoire/' . $row['slug'], ENT_XML1 | ENT_QUOTES, 'UTF-8');
    $lastModified = (new DateTimeImmutable((string) $row['updated_at'], new DateTimeZone('UTC')))->format('Y-m-d');
    echo "  <url><loc>{$url}</loc><lastmod>{$lastModified}</lastmod></url>" . PHP_EOL;
}
echo '</urlset>';
