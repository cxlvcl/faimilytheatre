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
    /** Text cut to $limit characters at a word boundary (spec: description up to 160). */
    public static function cut(string $value, int $limit = 160): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', str_replace('*', '', strip_tags($value))) ?? '');
        if (mb_strlen($text) <= $limit) return $text;
        $cut = mb_substr($text, 0, $limit - 1);
        $space = mb_strrpos($cut, ' ');
        return rtrim($space !== false && $space > $limit / 2 ? mb_substr($cut, 0, $space) : $cut, " ,;:—-") . '…';
    }
    /** Default robots.txt body; «Sitemap:» is always appended by robots.php. */
    public static function defaultRobots(): string
    {
        $lines = ['User-agent: *', 'Allow: /'];
        foreach (['/admin', '/auth', '/login', '/api/', '/preview', '/debug', '/.'] as $path) $lines[] = "Disallow: {$path}";
        return implode("\n", $lines);
    }
    private static function unquoted(string $title): string
    {
        return trim($title, " «»\"“”");
    }
    public function page(string $rawPath): array
    {
        $path = self::path($rawPath);
        $api = new PublicController($this->app);
        $store = new SeoStore($this->app->db()->pdo());
        $settings = $store->settings();
        $data = [];
        $show = null;
        $article = null;
        $status = 200;
        $route = self::ROUTES[$path] ?? null;
        // [title, description, breadcrumb name, h1]
        $info = $route ? [$route[0], $route[1], $route[2], $route[2]] : null;
        $metaKey = $route ? ['page', $path] : null;
        $cover = '';
        if ($path === '/repertoire') $data['/public/performances'] = $api->performances();
        if ($path === '/' || $path === '/afisha') $data['/public/events'] = $api->events();
        if ($path === '/faq') $data['/public/faq'] = $api->faq();
        if ($path === '/articles') $data['/public/articles'] = $api->articles();
        if (preg_match('#^/articles/([a-z0-9-]{1,180})$#', $path, $match)) {
            try {
                $article = $api->article($match[1]);
                $data['/public/articles/' . $match[1]] = $article;
                $info = [$article['title'] . ' | Театр Музыки и Песка', self::cut($article['excerpt']), $article['title'], $article['h1']];
                $metaKey = ['article', (string) $article['id']];
                $cover = $article['cover_image'];
            } catch (HttpException $error) { if ($error->status !== 404) throw $error; }
        }
        if (preg_match('#^/repertoire/([a-z0-9-]{1,180})$#', $path, $match)) {
            try {
                $show = $api->performance($match[1]);
                $data['/public/performances/' . $match[1]] = $show;
                $data['/public/events'] = $api->events();
                $info = [$show['title'] . ' — спектакль в Нижнем Новгороде | Театр Музыки и Песка', self::cut($show['short_description']), $show['title'], $show['h1']];
                $metaKey = ['performance', (string) $show['id']];
                $cover = $show['cover_image'] !== '' ? $show['cover_image'] : $show['hero_image'];
            } catch (HttpException $error) { if ($error->status !== 404) throw $error; }
        }
        if ($info === null) { $status = 404; $info = ['Страница не найдена — Театр Музыки и Песка', 'Эта страница не существует. Перейдите на главную страницу, в репертуар или афишу театра.', 'Страница не найдена', 'Страница не найдена']; }

        // Editor fields win; every empty field keeps the default above.
        $saved = $metaKey ? ($store->meta($metaKey[0], $metaKey[1]) ?? SeoStore::emptyMeta()) : SeoStore::emptyMeta();
        $title = $saved['title'] !== '' ? $saved['title'] : $info[0];
        $description = $saved['description'] !== '' ? $saved['description'] : $info[1];
        $h1 = $saved['h1'] !== '' ? $saved['h1'] : $info[3];
        // Phones share the canonical address; redirects keep using the ASCII form.
        $canonical = self::readableUrl($this->absolute($saved['canonical'] !== '' ? $saved['canonical'] : $path));
        $self = self::readableUrl($this->absolute($path));
        if ($saved['og_image'] !== '') {
            $image = $saved['og_image'];
            $size = [$saved['og_image_width'], $saved['og_image_height']];
        } elseif ($cover !== '' && ($preview = $this->app->upload()->previewJpeg($cover)) !== null) {
            // The main photo as a 1200×630 JPEG: VK and Telegram show it in every client.
            $image = $preview;
            $size = [1200, 630];
        } elseif ($cover !== '') {
            $image = $cover;
            $size = $this->app->upload()->dimensions($cover) ?? [null, null];
        } else {
            $image = '/media/hero-desktop.webp';
            $size = [1920, 1080];
        }
        $image = $this->absolute($image);
        $production = ($this->app->config['environment'] ?? 'development') === 'production';
        $robots = $status === 404 || !$production || $saved['noindex'] ? 'noindex, follow' : 'index, follow, max-image-preview:large';

        $home = self::readableUrl($this->absolute('/'));
        $phones = array_values(array_filter(explode("\n", $settings['org_phones']), 'strlen'));
        $organization = array_filter([
            '@type' => 'TheaterGroup', '@id' => $this->absolute('/#theatre'),
            'name' => $settings['org_name'], 'url' => $home,
            'logo' => $this->absolute('/media/contact-logo.webp'), 'image' => $this->absolute('/media/hero-desktop.webp'),
            'description' => $settings['org_description'],
            'telephone' => $phones[0] ?? null,
            'email' => $settings['org_email'] ?: null,
            'contactPoint' => $phones || $settings['org_email'] ? array_filter(['@type' => 'ContactPoint', 'telephone' => $phones[0] ?? null, 'email' => $settings['org_email'] ?: null, 'contactType' => 'Информация о спектаклях', 'availableLanguage' => 'ru']) : null,
            'address' => $settings['org_city'] !== '' ? ['@type' => 'PostalAddress', 'addressLocality' => $settings['org_city'], 'addressCountry' => 'RU'] : null,
            'sameAs' => array_values(array_filter([$settings['org_vk'], $settings['org_telegram'], $settings['org_yandex_maps']])) ?: null,
        ], static fn ($value) => $value !== null && $value !== '');
        $graph = $status === 200 ? [$organization] : [];

        $breadcrumbs = [];
        if ($path !== '/' && $status === 200) {
            $breadcrumbs = [['name' => 'Главная', 'path' => '/']];
            if ($show) $breadcrumbs[] = ['name' => 'Репертуар', 'path' => '/repertoire'];
            if ($article) {
                $breadcrumbs[] = ['name' => 'Статьи', 'path' => '/articles'];
                if ($article['rubric']) $breadcrumbs[] = ['name' => $article['rubric']['name'], 'path' => '/articles?rubric=' . $article['rubric']['slug']];
            }
            $breadcrumbs[] = ['name' => $info[2], 'path' => $path];
            $graph[] = ['@type' => 'BreadcrumbList', 'itemListElement' => array_map(fn ($item, $position) => ['@type' => 'ListItem', 'position' => $position + 1, 'name' => $item['name'], 'item' => self::readableUrl($this->absolute($item['path']))], $breadcrumbs, array_keys($breadcrumbs))];
        }
        if ($article) {
            $author = $article['author']
                ? array_filter(['@type' => 'Person', 'name' => $article['author']['name'], 'jobTitle' => $article['author']['position'] ?: null, 'image' => $article['author']['photo'] ? $this->absolute($article['author']['photo']) : null])
                : ['@type' => 'Organization', 'name' => $settings['org_name'], 'url' => $home];
            $graph[] = [
                '@type' => 'Article', '@id' => $self . '#article', 'headline' => $h1,
                'description' => $description, 'image' => $image, 'mainEntityOfPage' => $self,
                'datePublished' => $article['published_on'],
                'dateModified' => $article['updated_on'] ?? $article['published_on'],
                'author' => $author,
                'publisher' => ['@type' => 'Organization', 'name' => $settings['org_name'], 'url' => $home, 'logo' => ['@type' => 'ImageObject', 'url' => $this->absolute('/media/contact-logo.webp')]],
            ];
        }
        $events = $data['/public/events'] ?? [];
        // The home page shows only the three nearest dates; structured data must match visible content.
        if ($path === '/') $events = array_slice($events, 0, 3);
        $venues = $events ? $store->venueByName() : [];
        foreach ($events as $event) {
            if ($show && $event['performance']['slug'] !== $show['slug']) continue;
            $graph[] = $this->theaterEvent($event, $show, $venues[SeoStore::venueKey($event['venue'])] ?? null, $settings);
        }
        $faq = $show['faq'] ?? $article['faq'] ?? [];
        if ($faq) {
            $graph[] = ['@type' => 'FAQPage', '@id' => $self . '#faq', 'mainEntity' => array_map(static fn (array $pair): array => [
                '@type' => 'Question', 'name' => $pair['question'], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => PageHtml::plainText($pair['answer'])],
            ], $faq)];
        }
        $meta = ['path' => $path, 'status' => $status, 'title' => $title, 'description' => $description, 'h1' => $h1, 'canonical' => $canonical, 'image' => $image,
            'image_width' => $size[0], 'image_height' => $size[1],
            'og_title' => $saved['og_title'] !== '' ? $saved['og_title'] : $title,
            'og_description' => $saved['og_description'] !== '' ? $saved['og_description'] : $description,
            'og_type' => $article ? 'article' : 'website',
            'robots' => $robots,
            'schema' => ['@context' => 'https://schema.org', '@graph' => $graph], 'breadcrumbs' => $breadcrumbs];
        return ['meta' => $meta, 'data' => $data, 'performance' => $show, 'article' => $article];
    }

    /** One TheaterEvent per future date (owner's spec, section 3); empty fields are left out. */
    private function theaterEvent(array $event, ?array $show, ?array $venue, array $settings): array
    {
        $performance = $event['performance'];
        $details = $show['details'] ?? $performance['details'] ?? SeoStore::emptyDetails();
        $url = self::readableUrl($this->absolute('/repertoire/' . $performance['slug']));
        $name = self::unquoted($performance['title']);
        $address = $venue ? array_filter(['@type' => 'PostalAddress', 'addressLocality' => $venue['city'] ?: null, 'streetAddress' => $venue['street_address'] ?: null, 'postalCode' => $venue['postal_code'] ?: null, 'addressCountry' => 'RU']) : null;
        $duration = $details['duration_max'] ?? $details['duration_min'];
        $offers = array_filter([
            '@type' => 'Offer', 'url' => $event['ticket_url'],
            'price' => $details['price_from'] !== null ? (string) $details['price_from'] : null,
            'priceCurrency' => $details['price_from'] !== null ? 'RUB' : null,
            'availability' => $event['is_cancelled'] ? null : 'https://schema.org/InStock',
        ], static fn ($value) => $value !== null);
        $image = $show ? ($show['cover_image'] ?: $event['poster_image']) : $event['poster_image'];
        return array_filter([
            '@type' => 'TheaterEvent', '@id' => $url . '#event-' . $event['id'],
            'name' => $name,
            'alternateName' => $details['alternate_names'] ?: null,
            'description' => self::cut($performance['short_description'], 300) ?: null,
            'image' => $image !== '' ? $this->absolute($image) : null,
            'url' => $url,
            'startDate' => $event['event_date'] . ($event['event_time'] ? 'T' . $event['event_time'] . ':00+03:00' : ''),
            'duration' => $duration ? 'PT' . $duration . 'M' : null,
            'eventStatus' => $event['is_cancelled'] ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
            'eventAttendanceMode' => 'https://schema.org/OfflineEventAttendanceMode',
            'inLanguage' => 'ru',
            'typicalAgeRange' => $details['age_rating'] ? rtrim($details['age_rating'], '+') . '-' : null,
            'location' => array_filter(['@type' => 'Place', 'name' => $event['venue'], 'address' => $address]),
            'offers' => $offers,
            'organizer' => ['@type' => 'Organization', 'name' => $settings['org_name'], 'url' => self::readableUrl($this->absolute('/'))],
            'workPerformed' => array_filter([
                '@type' => 'CreativeWork',
                'name' => $details['work_title'] !== '' ? $details['work_title'] : $name,
                'author' => $details['work_author'] !== '' ? ['@type' => 'Person', 'name' => $details['work_author']] : null,
            ]),
        ], static fn ($value) => $value !== null && $value !== []);
    }
}
