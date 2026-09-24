<?php
declare(strict_types=1);

$bootstrap = getenv('THEATRE_API_BOOTSTRAP') ?: dirname(__DIR__) . '/bootstrap.php';
$app = require $bootstrap;
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: public, max-age=3600');
echo "User-agent: *\n";
echo "Allow: /\n";
echo "Disallow: /api/admin/\n";
echo 'Sitemap: ' . $app->config['base_url'] . "/sitemap.xml\n";

