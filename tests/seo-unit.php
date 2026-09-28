<?php
declare(strict_types=1);
require dirname(__DIR__) . '/api/src/Core/PageHtml.php';
require dirname(__DIR__) . '/api/src/Core/Seo.php';
use Theatre\Core\{PageHtml, Seo};
$checks = 0;
function verify(bool $ok, string $message): void { global $checks; if (!$ok) throw new RuntimeException($message); $checks++; }
foreach (['api/src', 'api/seo'] as $directory) {
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(dirname(__DIR__) . '/' . $directory)) as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') { token_get_all(file_get_contents($file->getPathname()), TOKEN_PARSE); $checks++; }
    }
}
foreach (['api/index.php', 'api/config.example.php'] as $file) { token_get_all(file_get_contents(dirname(__DIR__) . '/' . $file), TOKEN_PARSE); $checks++; }
verify(Seo::path('/REPERTOIRE/Test/?utm_source=x') === '/repertoire/test', 'Normalize path, strip tracking query');
verify(Seo::path('/') === '/', 'Keep homepage');
verify(!str_contains(PageHtml::markdown('<script>alert(1)</script>'), '<script>'), 'Escape HTML');
verify(str_contains(PageHtml::markdown('**Музыка** и *песок*'), '<strong>Музыка</strong> и <em>песок</em>'), 'Restricted markdown');
verify(str_contains(PageHtml::date(['event_date' => '2099-01-01', 'event_time' => '18:30']), '18:30'), 'Real start time');
verify(!str_contains(PageHtml::date(['event_date' => '2099-01-01', 'event_time' => null]), '00:00'), 'No invented start time');
verify(count(Seo::ROUTES) === count(array_unique(array_column(Seo::ROUTES, 0))), 'Unique static titles');
verify(count(Seo::ROUTES) === count(array_unique(array_column(Seo::ROUTES, 1))), 'Unique static descriptions');
echo "PHP syntax/SEO: {$checks} checks passed.\n";
