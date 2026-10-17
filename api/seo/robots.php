<?php
declare(strict_types=1);

$bootstrap = getenv('THEATRE_API_BOOTSTRAP') ?: dirname(__DIR__) . '/bootstrap.php';
$app = require $bootstrap;
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: public, max-age=3600');
// Text from «Настройки SEO», or the default; «Sitemap:» is always added here.
$custom = (new \Theatre\Core\SeoStore($app->db()->pdo()))->settings()['robots_txt'];
echo rtrim($custom !== '' ? $custom : \Theatre\Core\Seo::defaultRobots()) . "\n";
if (($app->config['environment'] ?? 'development') !== 'production') echo "Disallow: /\n";
echo "\nSitemap: " . $app->config['base_url'] . "/sitemap.xml\n";
