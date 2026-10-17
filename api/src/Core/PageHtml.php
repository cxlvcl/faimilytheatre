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
        // Links first, on the raw text: [текст](https://…) or [текст](/путь). Anything else stays text.
        $parts = preg_split('/(\[[^\[\]\n]{1,300}\]\((?:https?:\/\/|\/)[^\s()<>"]{0,500}\))/u', $text, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [$text];
        $html = '';
        foreach ($parts as $index => $part) {
            if ($index % 2 === 1 && preg_match('/^\[([^\]]+)\]\(([^)]+)\)$/u', $part, $link) === 1) {
                $external = !str_starts_with($link[2], '/');
                $html .= '<a href="' . self::e($link[2]) . '"' . ($external ? ' target="_blank" rel="noopener noreferrer"' : '') . '>' . self::emphasis($link[1]) . '</a>';
            } else {
                $html .= self::emphasis($part);
            }
        }
        return $html;
    }
    private static function emphasis(string $text): string
    {
        $text = self::e($text);
        $text = preg_replace('/\*\*(.+?)\*\*/su', '<strong>$1</strong>', $text);
        return (string) preg_replace('/(?<!\*)\*([^*]+)\*(?!\*)/su', '<em>$1</em>', (string) $text);
    }
    /** «Вопросы и ответы» answers: paragraphs, bold, italic and links. */
    public static function answer(string $value): string
    {
        return implode('', array_map(static fn ($paragraph): string => '<p>' . self::inline(str_replace("\n", ' ', trim($paragraph))) . '</p>', preg_split('/\n\s*\n/u', trim(str_replace("\r\n", "\n", $value))) ?: []));
    }
    /** Plain text of an answer for JSON-LD. */
    public static function plainText(string $value): string
    {
        $text = preg_replace('/\[([^\]]+)\]\([^)]+\)/u', '$1', $value) ?? $value;
        return trim(preg_replace('/\s+/u', ' ', str_replace(['**', '*'], '', $text)) ?? '');
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
    /** Article markup (mirrors ArticleMarkdown.tsx): ##/### headings, «- » and «1. » lists, «> » quotes,
     *  | tables |, ![подпись](/uploads/…) photos, paragraphs with bold, italic and links. */
    public static function articleMarkdown(string $value): string
    {
        $html = '';
        foreach (preg_split('/\n\s*\n/u', trim(str_replace("\r\n", "\n", $value))) ?: [] as $block) {
            $lines = array_values(array_filter(array_map('trim', explode("\n", $block)), 'strlen'));
            if ($lines === []) continue;
            $all = static fn (string $pattern): bool => array_filter($lines, static fn ($line) => preg_match($pattern, $line) !== 1) === [];
            if (count($lines) === 1 && preg_match('/^(#{2,3})\s+(.+)$/u', $lines[0], $match)) {
                $level = strlen($match[1]);
                $html .= "<h{$level}>" . self::inline($match[2]) . "</h{$level}>";
            } elseif (count($lines) === 1 && preg_match('/^!\[([^\]]*)\]\(((?:\/uploads\/|https:\/\/)[^\s()<>"]+)\)$/u', $lines[0], $match)) {
                $caption = trim($match[1]);
                $html .= '<figure class="article-photo"><img src="' . self::e($match[2]) . '" alt="' . self::e($caption) . '" loading="lazy" decoding="async">'
                    . ($caption !== '' ? '<figcaption>' . self::e($caption) . '</figcaption>' : '') . '</figure>';
            } elseif ($all('/^- /u')) {
                $html .= '<ul>' . implode('', array_map(static fn ($line) => '<li>' . self::inline(substr($line, 2)) . '</li>', $lines)) . '</ul>';
            } elseif ($all('/^\d{1,3}\.\s/u')) {
                $html .= '<ol>' . implode('', array_map(static fn ($line) => '<li>' . self::inline((string) preg_replace('/^\d{1,3}\.\s+/u', '', $line)) . '</li>', $lines)) . '</ol>';
            } elseif ($all('/^>/u')) {
                $html .= '<blockquote><p>' . self::inline(implode(' ', array_map(static fn ($line) => ltrim(substr($line, 1)), $lines))) . '</p></blockquote>';
            } elseif (count($lines) >= 2 && $all('/^\|.*\|$/u') && preg_match('/^\|(\s*:?-{3,}:?\s*\|)+$/u', $lines[1]) === 1) {
                $cells = static fn (string $line): array => array_map('trim', explode('|', trim($line, '|')));
                $html .= '<div class="article-table"><table><thead><tr>' . implode('', array_map(static fn ($cell) => '<th>' . self::inline($cell) . '</th>', $cells($lines[0]))) . '</tr></thead><tbody>';
                foreach (array_slice($lines, 2) as $row) $html .= '<tr>' . implode('', array_map(static fn ($cell) => '<td>' . self::inline($cell) . '</td>', $cells($row))) . '</tr>';
                $html .= '</tbody></table></div>';
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
    /** «12+ · 45–60 минут, без антракта · от 900 ₽»: only the filled parts. */
    public static function detailsLine(array $details): string
    {
        $parts = [];
        if (($details['age_rating'] ?? null) !== null) $parts[] = $details['age_rating'];
        $min = $details['duration_min'] ?? null; $max = $details['duration_max'] ?? null;
        if ($min !== null || $max !== null) {
            $range = $min !== null && $max !== null && $min !== $max ? "{$min}–{$max}" : (string) ($max ?? $min);
            $parts[] = $range . ' минут' . (!empty($details['has_intermission']) ? ', с антрактом' : ', без антракта');
        }
        if (($details['price_from'] ?? null) !== null) $parts[] = 'от ' . number_format((int) $details['price_from'], 0, '', ' ') . ' ₽';
        return implode(' · ', $parts);
    }
    /** «Вопросы и ответы»: answers are in the HTML, <details> only folds them. */
    public static function faqBlock(array $faq): string
    {
        if (!$faq) return '';
        $html = '<section class="content-faq" aria-labelledby="content-faq-title"><h2 id="content-faq-title">Вопросы и ответы</h2>';
        foreach ($faq as $pair) $html .= '<details class="content-faq__item"><summary>' . self::e($pair['question']) . '</summary><div class="content-faq__answer">' . self::answer($pair['answer']) . '</div></details>';
        return $html . '</section>';
    }
    public static function render(array $page, string $manifest): string
    {
        $path = $page['meta']['path'];
        $h1 = self::e((string) ($page['meta']['h1'] ?? ''));
        if ($path === '/' || $path === '/franchise') {
            $file = dirname($manifest) . '/ssr/' . ($path === '/' ? 'home' : 'franchise') . '.html';
            if (!is_file($file)) throw new \RuntimeException('Server HTML is missing; rebuild the web package.');
            $html = (string) file_get_contents($file);
            // The editor's H1 replaces the built one (home: the hidden text inside the logo heading).
            if ($path === '/' && $h1 !== '') $html = (string) preg_replace('#(<h1 class="hero__center"><span class="sr-only">)[^<]*(</span>)#u', '${1}' . $h1 . '${2}', $html, 1);
            return $html;
        }
        $data = $page['data'];
        $crumbs = self::breadcrumbs($page['meta']['breadcrumbs']);
        $body = '';
        if ($page['meta']['status'] === 404) {
            $body = '<section class="simple-page"><h1>Страница не найдена</h1><a href="/">На главную</a></section>';
        } elseif ($path === '/repertoire') {
            $body = '<div class="repertoire-page"><div class="listing-heading"><a href="/">Главная</a><h1>' . $h1 . '</h1></div>';
            foreach ($data['/public/performances'] as $index => $show) {
                $title = self::e($show['title']); $image = self::e($show['cover_image']); $url = '/repertoire/' . self::e($show['slug']); $loading = $index < 2 ? 'eager' : 'lazy';
                $body .= '<article class="repertoire-scene"><img class="repertoire-scene__background" src="' . $image . '" alt="" loading="' . $loading . '" decoding="async"><div class="repertoire-scene__shade"></div><div class="repertoire-scene__content"><a class="repertoire-scene__cover" href="' . $url . '" aria-label="О спектакле «' . $title . '»"><img src="' . $image . '" alt="" width="750" height="1000" loading="' . $loading . '" decoding="async"></a><div class="repertoire-scene__copy"><h2><a href="' . $url . '">' . $title . '</a></h2>' . ($show['is_premiere'] ? '<p class="premiere">Премьера</p>' : '') . '<p>' . self::e($show['short_description']) . '</p></div></div></article>';
            }
            $body .= '</div>';
        } elseif ($path === '/afisha') {
            $events = $data['/public/events'];
            $body = '<div class="afisha-page"><div class="listing-heading"><a href="/">Главная</a><h1>' . $h1 . '</h1></div>';
            if (!$events) $body .= '<section class="simple-page simple-page--dark"><p>Новые даты скоро появятся</p></section>';
            foreach ($events as $index => $event) {
                $title = self::e($event['performance']['title']); $image = self::e($event['poster_image']); $url = '/repertoire/' . self::e($event['performance']['slug']); $loading = $index < 2 ? 'eager' : 'lazy';
                $facts = self::detailsLine($event['performance']['details'] ?? []);
                $buy = $event['is_cancelled'] ? '<p class="event-scene__cancelled">Показ отменён</p>' : '<a class="event-scene__buy" href="' . self::e($event['ticket_url']) . '" target="_blank" rel="noopener noreferrer">Купить билет</a>';
                $body .= '<article class="event-scene" id="event-' . $event['id'] . '"><img class="event-scene__background" src="' . $image . '" alt="" loading="' . $loading . '"><div class="event-scene__shade"></div><div class="event-scene__content"><p class="event-scene__date">' . self::date($event) . '</p><a class="event-scene__poster-link" href="' . $url . '"><img class="event-scene__poster" src="' . $image . '" alt="' . self::e($event['poster_alt']) . '" width="750" height="1000" loading="' . $loading . '"></a><div class="event-scene__copy"><h2><a href="' . $url . '">' . $title . '</a></h2>' . ($event['performance']['is_premiere'] ? '<p class="premiere">Премьера</p>' : '') . ($facts !== '' ? '<p class="event-scene__facts">' . self::e($facts) . '</p>' : '') . '<p class="event-scene__venue">' . self::e($event['venue']) . '</p>' . $buy . '</div></div></article>';
            }
            $body .= '</div>';
        } elseif ($show = $page['performance']) {
            $title = self::e($show['title']);
            $second = $show['hero_image'] !== '' ? '<figure class="performance-paper__photo performance-paper__photo--second"><img src="' . self::e($show['hero_image']) . '" alt="' . self::e($show['hero_alt']) . '" loading="lazy" decoding="async"></figure>' : '';
            $facts = self::detailsLine($show['details']);
            $body = '<article class="performance-paper"><header class="performance-paper__head">' . $crumbs . '<h1>' . $h1 . '</h1>' . ($show['is_premiere'] ? '<p class="premiere premiere--dark">Премьера</p>' : '') . ($facts !== '' ? '<p class="performance-paper__facts">' . self::e($facts) . '</p>' : '') . '</header><div class="performance-paper__text"><figure class="performance-paper__photo performance-paper__photo--cover"><img src="' . self::e($show['cover_image']) . '" alt="' . self::e($show['cover_alt']) . '" width="750" height="1000" fetchpriority="high"></figure>' . self::paperText($show['description'], $second, $show['title']) . '</div>' . self::faqBlock($show['faq']) . '<section class="performance-paper__events"><h2>Ближайшие показы</h2>';
            $events = array_values(array_filter($data['/public/events'], static fn ($event) => $event['performance']['slug'] === $show['slug']));
            if (!$events) $body .= '<p>Новые даты скоро появятся.</p>';
            else {
                $body .= '<ul>';
                foreach ($events as $event) $body .= '<li>' . self::date($event) . ' — ' . self::e($event['venue']) . '. ' . ($event['is_cancelled'] ? '<strong>Показ отменён</strong>' : '<a href="' . self::e($event['ticket_url']) . '" target="_blank" rel="noopener noreferrer">Купить билет</a>') . '</li>';
                $body .= '</ul>';
            }
            $body .= '</section>';
            if ($show['articles']) {
                $body .= '<section class="related-articles"><h2>Статьи об этом спектакле</h2><ul>';
                foreach ($show['articles'] as $item) $body .= '<li><a href="/articles/' . self::e($item['slug']) . '">' . self::e($item['title']) . '</a></li>';
                $body .= '</ul></section>';
            }
            $body .= '<a class="performance-paper__back" href="/repertoire">Назад к списку спектаклей</a></article>';
        } elseif ($path === '/articles') {
            $body = '<section class="articles-page">' . $crumbs . '<h1>' . $h1 . '</h1>';
            if (!$data['/public/articles']) $body .= '<p class="articles-page__empty">Скоро здесь появятся первые статьи.</p>';
            else {
                $body .= '<div class="article-grid">';
                foreach ($data['/public/articles'] as $index => $item) {
                    $url = '/articles/' . self::e($item['slug']);
                    $body .= '<article class="article-card"><a class="article-card__link" href="' . $url . '"><img class="article-card__image" src="' . self::e($item['cover_image']) . '" alt="' . self::e($item['cover_alt']) . '" width="1200" height="800" loading="' . ($index < 3 ? 'eager' : 'lazy') . '" decoding="async"><div class="article-card__copy"><p class="article-card__date">' . self::articleDate($item['published_on']) . '</p><h2>' . self::e($item['title']) . '</h2><p>' . self::e($item['excerpt']) . '</p></div></a></article>';
                }
                $body .= '</div>';
            }
            $body .= '</section>';
        } elseif ($article = $page['article'] ?? null) {
            $author = $article['author'] ? '<p class="article-detail__author">' . self::e($article['author']['name']) . ($article['author']['position'] !== '' ? ', ' . self::e($article['author']['position']) : '') . '</p>' : '';
            $updated = $article['updated_on'] ? '<p class="article-detail__updated">Обновлено: ' . self::articleDate($article['updated_on']) . '</p>' : '';
            $body = '<article class="article-detail"><header class="article-detail__header">' . $crumbs . '<p class="article-detail__date">' . self::articleDate($article['published_on']) . '</p><h1>' . $h1 . '</h1><p class="article-detail__lead">' . self::e($article['excerpt']) . '</p></header><img class="article-detail__cover" src="' . self::e($article['cover_image']) . '" alt="' . self::e($article['cover_alt']) . '" width="1600" height="900" fetchpriority="high"><div class="article-detail__body">' . self::articleMarkdown($article['body']) . '</div>' . $author . $updated . self::faqBlock($article['faq']);
            if ($article['performances']) {
                $body .= '<section class="related-shows"><h2>Спектакли из статьи</h2><ul>';
                foreach ($article['performances'] as $item) {
                    $next = $item['next_event'];
                    $body .= '<li><a href="/repertoire/' . self::e($item['slug']) . '">' . self::e($item['title']) . '</a>' . ($next ? ' — ' . self::date($next) . ', ' . self::e($next['venue']) . '. <a href="' . self::e($next['ticket_url']) . '" target="_blank" rel="noopener noreferrer">Купить билет</a>' : '') . '</li>';
                }
                $body .= '</ul></section>';
            }
            $body .= '</article>';
        } elseif ($path === '/faq') {
            $body = '<section class="faq-page">' . $crumbs . '<h1>' . $h1 . '</h1><div class="faq-list">';
            foreach ($data['/public/faq'] as $faq) $body .= '<details class="faq-item"><summary>' . self::e($faq['question']) . '</summary><div class="faq-item__answer">' . self::markdown($faq['answer']) . '</div></details>';
            $body .= '</div></section>';
        }
        // Same tones as the React header: dark logo on the white pages (FAQ, articles, a performance).
        $light = preg_match('#^/(faq|articles)(/|$)|^/repertoire/[^/]+#', $path) === 1;
        $header = '<header class="site-header' . ($light ? ' site-header--light' : '') . '"><a class="site-header__logo" href="/" aria-label="На главную"><img src="/media/logo.webp" alt="Театр Музыки и Песка" width="900" height="900"></a></header>';
        return $header . '<main id="main-content">' . $body . '</main>';
    }
}
