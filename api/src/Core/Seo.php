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
    private function description(array $show): string
    {
        $text = trim(preg_replace('/\s+/u', ' ', str_replace('*', '', strip_tags((string) $show['short_description']))) ?? '');
        if ($text !== '' && mb_strlen($text) <= 240) return $text;
        if ($text !== '' && preg_match('/^(.{40,220}?[.!?])(?:\s|$)/u', $text, $match)) return $match[1];
        return '«' . $show['title'] . '» — спектакль Театра Музыки и Песка. Описание постановки, фотографии и ближайшие показы.';
    }
    public function page(string $rawPath): array
    {
        $path = self::path($rawPath);
        $api = new PublicController($this->app);
        $data = [];
        $show = null;
        $status = 200;
        $info = self::ROUTES[$path] ?? null;
        $image = $this->absolute('/media/hero-desktop.webp');
        if ($path === '/repertoire') $data['/public/performances'] = $api->performances();
        if ($path === '/afisha') $data['/public/events'] = $api->events();
        if ($path === '/faq') $data['/public/faq'] = $api->faq();
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
        $canonical = $this->absolute($path);
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
            $breadcrumbs[] = ['name' => $info[2], 'path' => $path];
            $graph[] = ['@type' => 'BreadcrumbList', 'itemListElement' => array_map(fn ($item, $position) => ['@type' => 'ListItem', 'position' => $position + 1, 'name' => $item['name'], 'item' => $this->absolute($item['path'])], $breadcrumbs, array_keys($breadcrumbs))];
        }
        foreach ($data['/public/events'] ?? [] as $event) {
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
        return ['meta' => $meta, 'data' => $data, 'performance' => $show];
    }
}
