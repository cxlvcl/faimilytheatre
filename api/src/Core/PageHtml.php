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
        if ($event['event_time']) { $time = ' · <span class="event-scene__time">Начало в ' . self::e($event['event_time']) . '</span>'; $datetime .= 'T' . $event['event_time']; }
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
            $focus = '--focus-desktop:' . (int) $show['hero_focus_desktop_x'] . '% ' . (int) $show['hero_focus_desktop_y'] . '%;--focus-mobile:' . (int) $show['hero_focus_mobile_x'] . '% ' . (int) $show['hero_focus_mobile_y'] . '%';
            $body = '<article class="performance-detail" style="' . $focus . '"><div class="performance-detail__hero"><img class="performance-detail__hero-image" src="' . self::e($show['hero_image']) . '" alt="Сцена из спектакля «' . $title . '»" width="1600" height="900" fetchpriority="high"><div class="performance-detail__hero-shade"></div></div><div class="performance-detail__body"><img class="performance-detail__cover" src="' . self::e($show['cover_image']) . '" alt="Постер спектакля «' . $title . '»" width="750" height="1000"><div class="performance-detail__copy">' . $crumbs . '<h1>' . $title . '</h1>' . ($show['is_premiere'] ? '<p class="premiere premiere--dark">Премьера</p>' : '') . '<div class="performance-detail__description">' . self::markdown($show['description']) . '</div><section class="performance-detail__events"><h2>Ближайшие показы</h2>';
            $events = array_values(array_filter($data['/public/events'], static fn ($event) => $event['performance']['slug'] === $show['slug']));
            if (!$events) $body .= '<p>Новые даты скоро появятся.</p>';
            else {
                $body .= '<ul>';
                foreach ($events as $event) $body .= '<li>' . self::date($event) . ' — ' . self::e($event['venue']) . '. <a href="' . self::e($event['ticket_url']) . '" target="_blank" rel="noopener noreferrer">Купить билет</a></li>';
                $body .= '</ul>';
            }
            $body .= '</section></div></div></article>';
        } elseif ($path === '/faq') {
            $body = '<section class="faq-page">' . $crumbs . '<h1>FAQ</h1><div class="faq-list">';
            foreach ($data['/public/faq'] as $faq) $body .= '<details class="faq-item"><summary>' . self::e($faq['question']) . '</summary><div class="faq-item__answer">' . self::markdown($faq['answer']) . '</div></details>';
            $body .= '</div></section>';
        }
        $header = '<header class="site-header"><a class="site-header__logo" href="/" aria-label="На главную"><img src="/media/logo.webp" alt="Театр Музыки и Песка" width="900" height="900"></a></header>';
        return $header . '<main id="main-content">' . $body . '</main>';
    }
}
