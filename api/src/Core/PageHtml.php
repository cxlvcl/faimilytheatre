<?php
declare(strict_types=1);
namespace Theatre\Core;

/** Visible, progressive server HTML using the same public data as the React app. */
final class PageHtml
{
    public static function e(string $value): string { return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
    public static function markdown(string $value): string
    {
        $paragraphs = preg_split('/\n\s*\n/u', trim($value)) ?: [];
        return implode('', array_map(static function ($paragraph): string {
            $text = self::e(str_replace("\n", ' ', $paragraph));
            $text = preg_replace('/\*\*(.+?)\*\*/su', '<strong>$1</strong>', $text);
            $text = preg_replace('/(?<!\*)\*([^*]+)\*(?!\*)/su', '<em>$1</em>', (string) $text);
            return '<p>' . $text . '</p>';
        }, $paragraphs));
    }
    private static function inline(string $text): string
    {
        $text = self::e($text);
        $text = preg_replace('/\*\*(.+?)\*\*/su', '<strong>$1</strong>', $text);
        return (string) preg_replace('/(?<!\*)\*([^*]+)\*(?!\*)/su', '<em>$1</em>', (string) $text);
    }
    /** Performance text with the second photo at the «[фото]» line, otherwise mid-text (same rule as paperLayout in the web app). */
    public static function paperText(string $description, string $photo, string $title = ''): string
    {
        $blocks = array_values(array_filter(array_map('trim', preg_split('/\n\s*\n/u', trim($description)) ?: []), static fn ($block) => $block !== ''));
        $lines = isset($blocks[0]) ? explode("\n", $blocks[0]) : [];
        if ($title !== '' && $lines && mb_strtolower(trim($lines[0])) === mb_strtolower(trim($title))) {
            $rest = trim(implode("\n", array_slice($lines, 1)));
            if ($rest !== '') $blocks[0] = $rest; else array_shift($blocks);
        }
        $isMarker = static fn (string $block): bool => preg_match('/^\[фото\]$/iu', $block) === 1;
        $paragraphs = array_values(array_filter($blocks, static fn ($block) => !$isMarker($block)));
        $marker = null;
        foreach ($blocks as $index => $block) { if ($isMarker($block)) { $marker = $index; break; } }
        $photoAt = $marker !== null ? count(array_filter(array_slice($blocks, 0, $marker), static fn ($block) => !$isMarker($block))) : (int) ceil(count($paragraphs) / 2);
        $html = '';
        foreach ($paragraphs as $index => $paragraph) {
            if ($index === $photoAt) $html .= $photo;
            $html .= '<p>' . self::inline(str_replace("\n", ' ', $paragraph)) . '</p>';
        }
        return $photoAt >= count($paragraphs) ? $html . $photo : $html;
    }
    /** Article markup: paragraphs, "## "/"### " subheadings and "- " lists. */
    public static function articleMarkdown(string $value): string
    {
        $html = '';
        foreach (preg_split('/\n\s*\n/u', trim(str_replace("\r\n", "\n", $value))) ?: [] as $block) {
            $lines = array_map('trim', explode("\n", $block));
            if (preg_match('/^(#{2,3})\s+(.+)$/u', $lines[0], $match) && count($lines) === 1) {
                $level = strlen($match[1]);
                $html .= "<h{$level}>" . self::inline($match[2]) . "</h{$level}>";
            } elseif (array_filter($lines, static fn ($line) => !str_starts_with($line, '- ')) === []) {
                $html .= '<ul>' . implode('', array_map(static fn ($line) => '<li>' . self::inline(substr($line, 2)) . '</li>', $lines)) . '</ul>';
            } else {
                $html .= '<p>' . self::inline(implode(' ', $lines)) . '</p>';
            }
        }
        return $html;
    }
    public static function articleDate(string $date): string
    {
        $value = new \DateTimeImmutable($date, new \DateTimeZone('Europe/Moscow'));
        $months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        return '<time datetime="' . self::e($date) . '">' . $value->format('j') . ' ' . $months[(int) $value->format('n') - 1] . ' ' . $value->format('Y') . '</time>';
    }
    public static function breadcrumbs(array $items): string
    {
        $links = [];
        foreach ($items as $index => $item) {
            $name = self::e($item['name']);
            $links[] = $index === count($items) - 1 ? '<span aria-current="page">' . $name . '</span>' : '<a href="' . self::e($item['path']) . '">' . $name . '</a>';
        }
        return '<nav class="breadcrumbs" aria-label="Хлебные крошки">' . implode('<span aria-hidden="true">/</span>', $links) . '</nav>';
    }
    public static function date(array $event): string
    {
        $date = new \DateTimeImmutable($event['event_date'], new \DateTimeZone('Europe/Moscow'));
        $months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        $text = $date->format('j') . ' ' . $months[(int) $date->format('n') - 1] . ' ' . $date->format('Y') . ' г.';
        $datetime = $event['event_date'];
        $time = '';
        if ($event['event_time']) { $time = '<span class="event-date__separator"> · </span><span class="event-scene__time">Начало в ' . self::e($event['event_time']) . '</span>'; $datetime .= 'T' . $event['event_time']; }
        return '<time datetime="' . self::e($datetime) . '">' . self::e($text) . $time . '</time>';
    }
    public static function render(array $page, string $manifest): string
    {
        $path = $page['meta']['path'];
        if ($path === '/' || $path === '/franchise') {
            $file = dirname($manifest) . '/ssr/' . ($path === '/' ? 'home' : 'franchise') . '.html';
            if (!is_file($file)) throw new \RuntimeException('Server HTML is missing; rebuild the web package.');
            return (string) file_get_contents($file);
        }
        $data = $page['data'];
        $crumbs = self::breadcrumbs($page['meta']['breadcrumbs']);
        $body = '';
        if ($page['meta']['status'] === 404) {
            $body = '<section class="simple-page"><h1>Страница не найдена</h1><a href="/">На главную</a></section>';
        } elseif ($path === '/repertoire') {
            $body = '<div class="repertoire-page"><div class="listing-heading"><a href="/">Главная</a><h1>Репертуар</h1></div>';
            foreach ($data['/public/performances'] as $index => $show) {
                $title = self::e($show['title']); $image = self::e($show['cover_image']); $url = '/repertoire/' . self::e($show['slug']); $loading = $index < 2 ? 'eager' : 'lazy';
                $body .= '<article class="repertoire-scene"><img class="repertoire-scene__background" src="' . $image . '" alt="" loading="' . $loading . '" decoding="async"><div class="repertoire-scene__shade"></div><div class="repertoire-scene__content"><a class="repertoire-scene__cover" href="' . $url . '" aria-label="О спектакле «' . $title . '»"><img src="' . $image . '" alt="" width="750" height="1000" loading="' . $loading . '" decoding="async"></a><div class="repertoire-scene__copy"><h2><a href="' . $url . '">' . $title . '</a></h2>' . ($show['is_premiere'] ? '<p class="premiere">Премьера</p>' : '') . '<p>' . self::e($show['short_description']) . '</p></div></div></article>';
            }
            $body .= '</div>';
        } elseif ($path === '/afisha') {
            $events = $data['/public/events'];
            $body = '<div class="afisha-page"><div class="listing-heading"><a href="/">Главная</a><h1>Афиша</h1></div>';
            if (!$events) $body .= '<section class="simple-page simple-page--dark"><p>Новые даты скоро появятся</p></section>';
            foreach ($events as $index => $event) {
                $title = self::e($event['performance']['title']); $image = self::e($event['poster_image']); $url = '/repertoire/' . self::e($event['performance']['slug']); $loading = $index < 2 ? 'eager' : 'lazy';
                $body .= '<article class="event-scene" id="event-' . $event['id'] . '"><img class="event-scene__background" src="' . $image . '" alt="" loading="' . $loading . '"><div class="event-scene__shade"></div><div class="event-scene__content"><p class="event-scene__date">' . self::date($event) . '</p><a class="event-scene__poster-link" href="' . $url . '"><img class="event-scene__poster" src="' . $image . '" alt="Афиша спектакля «' . $title . '»" width="750" height="1000" loading="' . $loading . '"></a><div class="event-scene__copy"><h2><a href="' . $url . '">' . $title . '</a></h2>' . ($event['performance']['is_premiere'] ? '<p class="premiere">Премьера</p>' : '') . '<p class="event-scene__venue">' . self::e($event['venue']) . '</p><a class="event-scene__buy" href="' . self::e($event['ticket_url']) . '" target="_blank" rel="noopener noreferrer">Купить билет</a></div></div></article>';
            }
            $body .= '</div>';
        } elseif ($show = $page['performance']) {
            $title = self::e($show['title']);
            $second = $show['hero_image'] !== '' ? '<figure class="performance-paper__photo performance-paper__photo--second"><img src="' . self::e($show['hero_image']) . '" alt="Сцена из спектакля «' . $title . '»" loading="lazy" decoding="async"></figure>' : '';
            $body = '<article class="performance-paper"><header class="performance-paper__head">' . $crumbs . '<h1>' . $title . '</h1>' . ($show['is_premiere'] ? '<p class="premiere premiere--dark">Премьера</p>' : '') . '</header><div class="performance-paper__text"><figure class="performance-paper__photo performance-paper__photo--cover"><img src="' . self::e($show['cover_image']) . '" alt="Постер спектакля «' . $title . '»" width="750" height="1000" fetchpriority="high"></figure>' . self::paperText($show['description'], $second, $show['title']) . '</div><section class="performance-paper__events"><h2>Ближайшие показы</h2>';
            $events = array_values(array_filter($data['/public/events'], static fn ($event) => $event['performance']['slug'] === $show['slug']));
            if (!$events) $body .= '<p>Новые даты скоро появятся.</p>';
            else {
                $body .= '<ul>';
                foreach ($events as $event) $body .= '<li>' . self::date($event) . ' — ' . self::e($event['venue']) . '. <a href="' . self::e($event['ticket_url']) . '" target="_blank" rel="noopener noreferrer">Купить билет</a></li>';
                $body .= '</ul>';
            }
            $body .= '</section><a class="performance-paper__back" href="/repertoire">Назад к списку спектаклей</a></article>';
        } elseif ($path === '/articles') {
            $body = '<section class="articles-page">' . $crumbs . '<h1>Статьи</h1>';
            if (!$data['/public/articles']) $body .= '<p class="articles-page__empty">Скоро здесь появятся первые статьи.</p>';
            else {
                $body .= '<div class="article-grid">';
                foreach ($data['/public/articles'] as $index => $item) {
                    $url = '/articles/' . self::e($item['slug']);
                    $body .= '<article class="article-card"><a class="article-card__link" href="' . $url . '"><img class="article-card__image" src="' . self::e($item['cover_image']) . '" alt="" width="1200" height="800" loading="' . ($index < 3 ? 'eager' : 'lazy') . '" decoding="async"><div class="article-card__copy"><p class="article-card__date">' . self::articleDate($item['published_on']) . '</p><h2>' . self::e($item['title']) . '</h2><p>' . self::e($item['excerpt']) . '</p></div></a></article>';
                }
                $body .= '</div>';
            }
            $body .= '</section>';
        } elseif ($article = $page['article'] ?? null) {
            $body = '<article class="article-detail"><header class="article-detail__header">' . $crumbs . '<p class="article-detail__date">' . self::articleDate($article['published_on']) . '</p><h1>' . self::e($article['title']) . '</h1><p class="article-detail__lead">' . self::e($article['excerpt']) . '</p></header><img class="article-detail__cover" src="' . self::e($article['cover_image']) . '" alt="" width="1600" height="900" fetchpriority="high"><div class="article-detail__body">' . self::articleMarkdown($article['body']) . '</div></article>';
        } elseif ($path === '/faq') {
            $body = '<section class="faq-page">' . $crumbs . '<h1>FAQ</h1><div class="faq-list">';
            foreach ($data['/public/faq'] as $faq) $body .= '<details class="faq-item"><summary>' . self::e($faq['question']) . '</summary><div class="faq-item__answer">' . self::markdown($faq['answer']) . '</div></details>';
            $body .= '</div></section>';
        }
        // Same tones as the React header: dark logo on the white pages (FAQ, articles, a performance).
        $light = preg_match('#^/(faq|articles)(/|$)|^/repertoire/[^/]+#', $path) === 1;
        $header = '<header class="site-header' . ($light ? ' site-header--light' : '') . '"><a class="site-header__logo" href="/" aria-label="На главную"><img src="/media/logo.webp" alt="Театр Музыки и Песка" width="900" height="900"></a></header>';
        return $header . '<main id="main-content">' . $body . '</main>';
    }
}
