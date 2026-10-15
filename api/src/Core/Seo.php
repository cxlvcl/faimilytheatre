<?php
declare(strict_types=1);
namespace Theatre\Core;

use Theatre\Controllers\PublicController;

/** One metadata/data projection, shared by HTML responses and SPA navigation. */
final class Seo
{
    public const ROUTES = [
        '/' => ['Театр Музыки и Песка — музыкальные спектакли и песочная анимация', 'Театр Музыки и Песка — музыкальные спектакли, живая музыка и песочная анимация. Репертуар, афиша и ближайшие показы.', 'Главная'],
        '/repertoire' => ['Репертуар — Театр Музыки и Песка', 'Спектакли Театра Музыки и Песка: истории, рассказанные живой музыкой, словом и песочной анимацией. Описание постановок и ближайшие показы.', 'Репертуар'],
        '/afisha' => ['Афиша — Театр Музыки и Песка', 'Ближайшие показы Театра Музыки и Песка. Даты, время, площадки проведения спектаклей и ссылки на билеты.', 'Афиша'],
        '/articles' => ['Статьи — Театр Музыки и Песка', 'Статьи Театра Музыки и Песка: о спектаклях, живой музыке, песочной анимации и о том, как мы создаём истории для детей и взрослых.', 'Статьи'],
        '/faq' => ['Вопросы и ответы — Театр Музыки и Песка', 'Ответы на вопросы о спектаклях Театра Музыки и Песка: формат представлений, посещение и информация для зрителей.', 'FAQ'],
        '/franchise' => ['Франшиза — Театр Музыки и Песка', 'Откройте Театр Музыки и Песка в своём городе: готовый репертуар, подготовка команды и сопровождение запуска.', 'Франшиза'],
    ];

    public function __construct(private readonly App $app) {}
    public static function path(string $path): string { return '/' . trim(strtolower(rawurldecode(explode('?', $path, 2)[0])), '/'); }
    public function absolute(string $url): string
    {
        if (preg_match('#^https?://#i', $url)) return $url;
        return rtrim((string) $this->app->config['base_url'], '/') . '/' . ltrim($url, '/');
    }
    /** The address people see and share: «театрмузыкиипеска.рф» instead of its xn-- form. */
    public static function readableUrl(string $url): string
    {
        return preg_replace_callback('#^(https?://)([^/?\#]+)#i', fn ($match) => $match[1] . implode('.', array_map(
            fn ($label) => str_starts_with(strtolower($label), 'xn--') ? (self::punycodeDecode(substr($label, 4)) ?? $label) : $label,
            explode('.', $match[2]),
        )), $url) ?? $url;
    }
    /** RFC 3492 decoding without the intl extension, which shared hosting may lack. */
    private static function punycodeDecode(string $input): ?string
    {
        $input = strtolower($input);
        $split = strrpos($input, '-');
        $output = $split === false ? [] : array_map('ord', str_split(substr($input, 0, $split)));
        $n = 128; $i = 0; $bias = 72; $first = true;
        for ($position = $split === false ? 0 : $split + 1, $length = strlen($input); $position < $length;) {
            $old = $i;
            for ($weight = 1, $k = 36; ; $k += 36) {
                if ($position >= $length) return null;
                $char = ord($input[$position++]);
                $digit = $char >= 97 && $char <= 122 ? $char - 97 : ($char >= 48 && $char <= 57 ? $char - 22 : -1);
                if ($digit < 0) return null;
                $i += $digit * $weight;
                $t = $k <= $bias ? 1 : ($k >= $bias + 26 ? 26 : $k - $bias);
                if ($digit < $t) break;
                $weight *= 36 - $t;
            }
            $count = count($output) + 1;
            $delta = intdiv($i - $old, $first ? 700 : 2);
            $first = false;
            $delta += intdiv($delta, $count);
            for ($bias = 0; $delta > 455; $bias += 36) $delta = intdiv($delta, 35);
            $bias += intdiv(36 * $delta, $delta + 38);
            $n += intdiv($i, $count);
            $i %= $count;
            array_splice($output, $i++, 0, [$n]);
        }
        return implode('', array_map('mb_chr', $output));
    }
    private function description(array $show): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', str_replace('*', '', strip_tags((string) $show['short_description']))) ?? '');
        if ($text !== '' && mb_strlen($text) <= 240) return $text;
        if ($text !== '' && preg_match('/^(.{40,220}?[.!?])(?:\s|$)/u', $text, $match)) return $match[1];
        return '«' . $show['title'] . '» — спектакль Театра Музыки и Песка. Описание постановки, фотографии и ближайшие показы.';
    }
    private function excerpt(string $value): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
        return mb_strlen($text) <= 240 ? $text : rtrim(mb_substr($text, 0, 237)) . '…';
    }
    public function page(string $rawPath): array
    {
        $path = self::path($rawPath);
        $api = new PublicController($this->app);
        $data = [];
        $show = null;
        $article = null;
        $status = 200;
        $info = self::ROUTES[$path] ?? null;
        $image = $this->absolute('/media/hero-desktop.webp');
        if ($path === '/repertoire') $data['/public/performances'] = $api->performances();
        if ($path === '/' || $path === '/afisha') $data['/public/events'] = $api->events();
        if ($path === '/faq') $data['/public/faq'] = $api->faq();
        if ($path === '/articles') $data['/public/articles'] = $api->articles();
        if (preg_match('#^/articles/([a-z0-9-]{1,180})$#', $path, $match)) {
            try {
                $article = $api->article($match[1]);
                $data['/public/articles/' . $match[1]] = $article;
                $info = [$article['title'] . ' | Театр Музыки и Песка', $this->excerpt($article['excerpt']), $article['title']];
                if ($article['cover_image'] !== '') $image = $this->absolute($article['cover_image']);
            } catch (HttpException $error) { if ($error->status !== 404) throw $error; }
        }
        if (preg_match('#^/repertoire/([a-z0-9-]{1,180})$#', $path, $match)) {
            try {
                $show = $api->performance($match[1]);
                $data['/public/performances/' . $match[1]] = $show;
                $data['/public/events'] = $api->events();
                $info = [$show['title'] . ' — спектакль | Театр Музыки и Песка', $this->description($show), $show['title']];
                if ($show['cover_image'] !== '') $image = $this->absolute($show['cover_image']);
                elseif ($show['hero_image'] !== '') $image = $this->absolute($show['hero_image']);
            } catch (HttpException $error) { if ($error->status !== 404) throw $error; }
        }
        if ($info === null) { $status = 404; $info = ['Страница не найдена — Театр Музыки и Песка', 'Эта страница не существует. Перейдите на главную страницу, в репертуар или афишу театра.', 'Страница не найдена']; }
        // Phones share the canonical address; redirects keep using the ASCII form.
        $canonical = self::readableUrl($this->absolute($path));
        $organization = [
            '@type' => 'TheaterGroup', '@id' => $this->absolute('/#theatre'),
            'name' => 'Театр Музыки и Песка', 'url' => $this->absolute('/'),
            'logo' => $this->absolute('/media/contact-logo.webp'), 'image' => $this->absolute('/media/hero-desktop.webp'),
            'description' => 'Живая музыка, художественное слово и песочная анимация.',
            'contactPoint' => ['@type' => 'ContactPoint', 'telephone' => '+7-831-423-58-04', 'email' => 'info@teatrmip-nn.ru', 'contactType' => 'Информация о спектаклях', 'availableLanguage' => 'ru'],
            'address' => ['@type' => 'PostalAddress', 'addressLocality' => 'Нижний Новгород', 'addressCountry' => 'RU'],
        ];
        $graph = $status === 200 ? [$organization] : [];
        $breadcrumbs = [];
        if ($path !== '/' && $status === 200) {
            $breadcrumbs = [['name' => 'Главная', 'path' => '/']];
            if ($show) $breadcrumbs[] = ['name' => 'Репертуар', 'path' => '/repertoire'];
            if ($article) $breadcrumbs[] = ['name' => 'Статьи', 'path' => '/articles'];
            $breadcrumbs[] = ['name' => $info[2], 'path' => $path];
            $graph[] = ['@type' => 'BreadcrumbList', 'itemListElement' => array_map(fn ($item, $position) => ['@type' => 'ListItem', 'position' => $position + 1, 'name' => $item['name'], 'item' => $this->absolute($item['path'])], $breadcrumbs, array_keys($breadcrumbs))];
        }
        if ($article) {
            $graph[] = [
                '@type' => 'Article', '@id' => $canonical . '#article', 'headline' => $article['title'],
                'description' => $info[1], 'image' => $image, 'mainEntityOfPage' => $canonical,
                'datePublished' => $article['published_on'],
                'dateModified' => (new \DateTimeImmutable($article['updated_at'], new \DateTimeZone('UTC')))->format(DATE_ATOM),
                'author' => ['@id' => $organization['@id']], 'publisher' => ['@id' => $organization['@id']],
            ];
        }
        $events = $data['/public/events'] ?? [];
        // The home page shows only the three nearest dates; structured data must match visible content.
        if ($path === '/') $events = array_slice($events, 0, 3);
        foreach ($events as $event) {
            if ($show && $event['performance']['slug'] !== $show['slug']) continue;
            $graph[] = [
                '@type' => 'TheaterEvent', '@id' => $this->absolute('/afisha#event-' . $event['id']),
                'url' => $this->absolute('/afisha#event-' . $event['id']), 'name' => $event['performance']['title'],
                'image' => $this->absolute($event['poster_image']),
                'startDate' => $event['event_date'] . ($event['event_time'] ? 'T' . $event['event_time'] . ':00+03:00' : ''),
                'location' => ['@type' => 'Place', 'name' => $event['venue']],
                'organizer' => ['@id' => $organization['@id']],
                'workPerformed' => ['@type' => 'CreativeWork', 'name' => $event['performance']['title'], 'url' => $this->absolute('/repertoire/' . $event['performance']['slug'])],
                // There is no price/status/address field: do not invent these.
            ];
        }
        $meta = ['path' => $path, 'status' => $status, 'title' => $info[0], 'description' => $info[1], 'canonical' => $canonical, 'image' => $image,
            'robots' => $status === 404 || ($this->app->config['environment'] ?? 'development') !== 'production' ? 'noindex, follow' : 'index, follow, max-image-preview:large',
            'schema' => ['@context' => 'https://schema.org', '@graph' => $graph], 'breadcrumbs' => $breadcrumbs];
        return ['meta' => $meta, 'data' => $data, 'performance' => $show, 'article' => $article];
    }
}
