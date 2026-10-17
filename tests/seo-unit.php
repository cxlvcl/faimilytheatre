<?php
declare(strict_types=1);
require dirname(__DIR__) . '/api/src/Core/PageHtml.php';
require dirname(__DIR__) . '/api/src/Core/Seo.php';
require dirname(__DIR__) . '/api/src/Core/Validator.php';
require dirname(__DIR__) . '/api/src/Core/HttpException.php';
require dirname(__DIR__) . '/api/src/Core/SeoStore.php';
require dirname(__DIR__) . '/api/src/Core/SeoInput.php';
use Theatre\Core\{PageHtml, Seo, SeoInput};
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
verify(Seo::readableUrl('https://xn--80aanbjgaodo1bgudcs1l.xn--p1ai/repertoire/x') === 'https://театрмузыкиипеска.рф/repertoire/x', 'Readable Cyrillic address');
verify(Seo::readableUrl('https://xn--mnchen-3ya.de/') === 'https://münchen.de/', 'Decode mixed labels');
verify(Seo::readableUrl('https://example.ru/a') === 'https://example.ru/a', 'Leave ASCII hosts alone');
verify(!str_contains(PageHtml::markdown('<script>alert(1)</script>'), '<script>'), 'Escape HTML');
verify(str_contains(PageHtml::markdown('**Музыка** и *песок*'), '<strong>Музыка</strong> и <em>песок</em>'), 'Restricted markdown');
verify(str_contains(PageHtml::date(['event_date' => '2099-01-01', 'event_time' => '18:30']), '18:30'), 'Real start time');
verify(!str_contains(PageHtml::date(['event_date' => '2099-01-01', 'event_time' => null]), '00:00'), 'No invented start time');
verify(count(Seo::ROUTES) === count(array_unique(array_column(Seo::ROUTES, 0))), 'Unique static titles');
verify(count(Seo::ROUTES) === count(array_unique(array_column(Seo::ROUTES, 1))), 'Unique static descriptions');
// SEO fields (owner's spec): defaults, escaping, validation.
verify(Seo::cut(str_repeat('слово ', 40)) !== '' && mb_strlen(Seo::cut(str_repeat('слово ', 40))) <= 160 && str_ends_with(Seo::cut(str_repeat('слово ', 40)), '…'), 'Description cut to 160 at a word');
verify(Seo::cut('Коротко.') === 'Коротко.', 'Short description unchanged');
verify(PageHtml::detailsLine(['age_rating' => '12+', 'duration_min' => 45, 'duration_max' => 60, 'has_intermission' => false, 'price_from' => 900]) === '12+ · 45–60 минут, без антракта · от 900 ₽', 'Facts line');
verify(PageHtml::detailsLine(['age_rating' => null, 'duration_min' => null, 'duration_max' => null, 'has_intermission' => false, 'price_from' => null]) === '', 'Empty facts line');
verify(str_contains(PageHtml::faqBlock([['question' => '<b>Q</b>', 'answer' => 'A [x](https://e.ru)']]), '&lt;b&gt;Q&lt;/b&gt;'), 'FAQ question escaped');
verify(str_contains(PageHtml::answer('[x](javascript:alert(1))'), '[x](javascript:alert(1))') && !str_contains(PageHtml::answer('[x](javascript:alert(1))'), 'href'), 'No javascript links');
verify(str_contains(PageHtml::answer('[сайт](https://e.ru)'), 'rel="noopener noreferrer"'), 'External links are safe');
verify(PageHtml::plainText('**Да**, [здесь](/afisha).') === 'Да, здесь.', 'Plain FAQ answer for JSON-LD');
verify(str_contains(PageHtml::articleMarkdown("| A | B |\n| --- | --- |\n| <i> | 2 |"), '<td>&lt;i&gt;</td>'), 'Table cells escaped');
verify(str_contains(PageHtml::articleMarkdown('![Фото <x>](/uploads/a.webp)'), 'loading="lazy"') && str_contains(PageHtml::articleMarkdown('![Фото <x>](/uploads/a.webp)'), 'alt="Фото &lt;x&gt;"'), 'Article photo lazy with escaped alt');
verify(!str_contains(PageHtml::articleMarkdown('![x](javascript:1)'), '<img'), 'Photo only from uploads/https');
$errors = []; SeoInput::settings(['metrika_id' => '<script>', 'org_name' => 'Театр', 'robots_txt' => "Sitemap: x"], $errors);
verify(isset($errors['metrika_id'], $errors['robots_txt']), 'Counter ids digits only; Sitemap line rejected');
verify(SeoInput::verificationCode('<meta name="yandex-verification" content="abc123" />') === 'abc123', 'Verification code from a pasted tag');
verify(SeoInput::metaTag('<meta name="vk-verification" content="x1">') === ['name' => 'vk-verification', 'content' => 'x1'], 'VK meta tag parsed');
verify(SeoInput::metaTag('<meta name="a" content="b"><script>') === null && SeoInput::metaTag('<script>alert(1)</script>') === null, 'Only one plain meta tag');
$errors = []; $meta = SeoInput::meta(['seo_title' => 'T <b>', 'seo_canonical' => 'javascript:alert(1)'], $errors);
verify(isset($errors['seo_title'], $errors['seo_canonical']), 'SEO title plain text; canonical only path/URL');
$errors = []; $slug = SeoInput::slug(['slug' => 'Новый адрес'], $errors);
verify(isset($errors['slug']), 'Slug latin only');
$errors = []; $faq = SeoInput::faq(['faq_present' => '1', 'faq' => [['question' => str_repeat('я', 151), 'answer' => 'a']]], $errors);
verify(isset($errors['faq']), 'Question up to 150 characters');
$errors = []; $details = SeoInput::performanceDetails(['details_present' => '1', 'duration_min' => '60', 'duration_max' => '45', 'age_rating' => '18+'], $errors);
verify(isset($errors['duration_max'], $errors['age_rating']), 'Duration order and age list');
$errors = []; verify(SeoInput::redirectPath('https://old.tilda.ws/Page1.HTML', 'from', $errors, false) === '/page1.html' && $errors === [], 'Old full address becomes a path');
echo "PHP syntax/SEO: {$checks} checks passed.\n";
