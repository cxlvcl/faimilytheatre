<?php
declare(strict_types=1);

namespace Theatre\Controllers;

use DateTimeImmutable;
use DateTimeZone;
use Theatre\Core\App;
use Theatre\Core\HttpException;
use Theatre\Core\PerformanceCategories;
use Theatre\Core\Request;
use Theatre\Core\SeoStore;
use Theatre\Core\Validator;

final class PublicController
{
    public function __construct(private readonly App $app)
    {
    }

    public function performances(): array
    {
        $rows = $this->app->db()->pdo()->query(
            'SELECT id, slug, title, short_description, cover_image, is_premiere
             FROM performances ORDER BY sort_order ASC, id ASC'
        )->fetchAll();
        $categories = PerformanceCategories::load($this->app->db()->pdo());
        return array_map(fn (array $row): array => $this->performanceSummary($row) + ['categories' => $categories[(int) $row['id']] ?? []], $rows);
    }

    public function performance(string $slug): array
    {
        $statement = $this->app->db()->pdo()->prepare(
            'SELECT id, slug, title, short_description, description, cover_image, hero_image,
                    hero_focus_desktop_x, hero_focus_desktop_y,
                    hero_focus_mobile_x, hero_focus_mobile_y, is_premiere
             FROM performances WHERE slug = :slug LIMIT 1'
        );
        $statement->execute(['slug' => $slug]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            throw new HttpException(404, 'not_found', 'Спектакль не найден');
        }
        $id = (int) $row['id'];
        $title = (string) $row['title'];
        $store = $this->store();
        $alts = $store->alts('performance', $id);
        $meta = $store->meta('performance', (string) $id);
        $articleIds = $store->links()[$id] ?? [];
        return [
            'id' => $id,
            'slug' => (string) $row['slug'],
            'title' => $title,
            'h1' => ($meta['h1'] ?? '') !== '' ? $meta['h1'] : $title,
            'cover_alt' => $alts['cover_image'] ?? $this->photoAlt($title, 1),
            'hero_alt' => $alts['hero_image'] ?? $this->photoAlt($title, 2),
            'details' => $store->performanceDetails($id),
            'faq' => $store->publicFaq('performance', $id),
            // «Статьи об этом спектакле»: up to three, newest first.
            'articles' => array_slice(array_values(array_filter($this->articles(), static fn (array $article): bool => in_array($article['id'], $articleIds, true))), 0, 3),
            'short_description' => (string) $row['short_description'],
            'description' => (string) $row['description'],
            'cover_image' => (string) $row['cover_image'],
            'hero_image' => (string) $row['hero_image'],
            'hero_focus_desktop_x' => (int) $row['hero_focus_desktop_x'],
            'hero_focus_desktop_y' => (int) $row['hero_focus_desktop_y'],
            'hero_focus_mobile_x' => (int) $row['hero_focus_mobile_x'],
            'hero_focus_mobile_y' => (int) $row['hero_focus_mobile_y'],
            'is_premiere' => (bool) $row['is_premiere'],
        ];
    }

    public function events(): array
    {
        $today = (new DateTimeImmutable('now', new DateTimeZone('Europe/Moscow')))->format('Y-m-d');
        $statement = $this->app->db()->pdo()->prepare(
            'SELECT e.id, e.event_date, e.event_time, e.venue, e.poster_image, e.ticket_url,
                    p.id AS performance_id, p.slug, p.title, p.short_description, p.is_premiere
             FROM events e
             INNER JOIN performances p ON p.id = e.performance_id
             WHERE e.event_date >= :today
             ORDER BY e.event_date ASC, e.event_time IS NULL ASC, e.event_time ASC, e.id ASC'
        );
        $statement->execute(['today' => $today]);
        $rows = $statement->fetchAll();
        $store = $this->store();
        $cancelled = $store->cancelledMap();
        $alts = $store->altsMap('event', array_map(static fn (array $row): int => (int) $row['id'], $rows));
        $details = $store->performanceDetailsMap(array_values(array_unique(array_map(static fn (array $row): int => (int) $row['performance_id'], $rows))));
        return array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'event_date' => (string) $row['event_date'],
            'event_time' => $row['event_time'] === null ? null : substr((string) $row['event_time'], 0, 5),
            'venue' => (string) $row['venue'],
            'poster_image' => (string) $row['poster_image'],
            'poster_alt' => $alts[(int) $row['id']]['poster_image'] ?? 'Афиша спектакля ' . $row['title'],
            'ticket_url' => (string) $row['ticket_url'],
            'is_cancelled' => $cancelled[(int) $row['id']] ?? false,
            'performance' => [
                'id' => (int) $row['performance_id'],
                'slug' => (string) $row['slug'],
                'title' => (string) $row['title'],
                'short_description' => (string) $row['short_description'],
                'is_premiere' => (bool) $row['is_premiere'],
                'details' => $details[(int) $row['performance_id']] ?? SeoStore::emptyDetails(),
            ],
        ], $rows);
    }

    public function faq(): array
    {
        $rows = $this->app->db()->pdo()->query(
            'SELECT id, question, answer FROM faq ORDER BY sort_order ASC, id ASC'
        )->fetchAll();
        return array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'question' => (string) $row['question'],
            'answer' => (string) $row['answer'],
        ], $rows);
    }

    public function articles(): array
    {
        $statement = $this->app->db()->pdo()->prepare(
            'SELECT id, slug, title, excerpt, cover_image, published_on
             FROM articles WHERE is_published = 1 AND published_on <= :today
             ORDER BY published_on DESC, id DESC'
        );
        $statement->execute(['today' => $this->moscowToday()]);
        $rows = $statement->fetchAll();
        $store = $this->store();
        $details = $store->articleDetailsMap();
        $rubrics = array_column($store->rubrics(), null, 'id');
        $alts = $store->altsMap('article', array_map(static fn (array $row): int => (int) $row['id'], $rows));
        return array_map(function (array $row) use ($details, $rubrics, $alts): array {
            $id = (int) $row['id'];
            $rubric = $rubrics[$details[$id]['rubric_id'] ?? 0] ?? null;
            return $this->articleSummary($row) + [
                'cover_alt' => $alts[$id]['cover_image'] ?? (string) $row['title'],
                'rubric' => $rubric ? ['slug' => $rubric['slug'], 'name' => $rubric['name']] : null,
            ];
        }, $rows);
    }

    public function article(string $slug): array
    {
        $statement = $this->app->db()->pdo()->prepare(
            'SELECT id, slug, title, excerpt, body, cover_image, published_on, updated_at
             FROM articles WHERE slug = :slug AND is_published = 1 AND published_on <= :today LIMIT 1'
        );
        $statement->execute(['slug' => $slug, 'today' => $this->moscowToday()]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            throw new HttpException(404, 'not_found', 'Статья не найдена');
        }
        $id = (int) $row['id'];
        $store = $this->store();
        $details = $store->articleDetailsMap()[$id] ?? ['author_id' => null, 'rubric_id' => null, 'updated_on' => null];
        $author = null;
        foreach ($store->authors() as $candidate) if ($candidate['id'] === $details['author_id']) $author = ['name' => $candidate['name'], 'position' => $candidate['position'], 'photo' => $candidate['photo']];
        $rubric = null;
        foreach ($store->rubrics() as $candidate) if ($candidate['id'] === $details['rubric_id']) $rubric = ['slug' => $candidate['slug'], 'name' => $candidate['name']];
        $meta = $store->meta('article', (string) $id);
        $alts = $store->alts('article', $id);
        // «Связанные спектакли»: cards with the nearest date and its ticket link.
        $linked = $store->links(true)[$id] ?? [];
        $shows = [];
        if ($linked !== []) {
            $events = $this->events();
            $list = $this->app->db()->pdo()->prepare('SELECT id, slug, title, short_description, cover_image, is_premiere FROM performances WHERE id IN (' . implode(',', array_fill(0, count($linked), '?')) . ') ORDER BY sort_order, id');
            $list->execute($linked);
            foreach ($list->fetchAll() as $show) {
                $next = null;
                foreach ($events as $event) if ($event['performance']['id'] === (int) $show['id'] && !$event['is_cancelled']) { $next = ['id' => $event['id'], 'event_date' => $event['event_date'], 'event_time' => $event['event_time'], 'venue' => $event['venue'], 'ticket_url' => $event['ticket_url']]; break; }
                $shows[] = $this->performanceSummary($show) + ['next_event' => $next];
            }
        }
        return $this->articleSummary($row) + [
            'h1' => ($meta['h1'] ?? '') !== '' ? $meta['h1'] : (string) $row['title'],
            'cover_alt' => $alts['cover_image'] ?? (string) $row['title'],
            'body' => (string) $row['body'],
            'updated_at' => (string) $row['updated_at'],
            'updated_on' => $details['updated_on'],
            'author' => $author,
            'rubric' => $rubric,
            'faq' => $store->publicFaq('article', $id),
            'performances' => $shows,
        ];
    }

    public function franchise(Request $request): array
    {
        $input = $request->body();
        if (isset($input['website']) && (!is_string($input['website']) || trim($input['website']) !== '')) {
            throw new HttpException(422, 'validation_failed', 'Не удалось отправить заявку. Попробуйте ещё раз.');
        }
        $rateKey = $this->app->rateLimiter()->ipKey($request->clientIp());
        $this->app->rateLimiter()->enforce('franchise', $rateKey, 3, 1800);

        $errors = [];
        $name = Validator::text($input, 'name', 2, 100, $errors);
        $city = Validator::text($input, 'city', 2, 100, $errors);
        $sourcePhone = Validator::text($input, 'phone', 7, 32, $errors);
        foreach (['name' => $name, 'city' => $city] as $field => $value) {
            if ($value !== strip_tags($value)) $errors[$field] = 'Допустим только обычный текст';
        }
        if (preg_match('/^[+\d\s().-]+$/u', $sourcePhone) !== 1) $errors['phone'] = 'Введите корректный телефон';
        if (mb_strlen($sourcePhone) > 32) {
            $errors['phone'] = 'Телефон слишком длинный';
        }
        $digits = preg_replace('/\D+/', '', $sourcePhone) ?? '';
        if (strlen($digits) < 7 || strlen($digits) > 15) {
            $errors['phone'] = 'Введите корректный телефон';
        }
        Validator::throwIfErrors($errors);
        if (strlen($digits) === 11 && str_starts_with($digits, '8')) {
            $digits = '7' . substr($digits, 1);
        }
        $phone = '+' . $digits;

        $statement = $this->app->db()->pdo()->prepare(
            "INSERT INTO franchise_applications (name, city, phone, status, created_at, updated_at)
             VALUES (:name, :city, :phone, 'new', UTC_TIMESTAMP(), UTC_TIMESTAMP())"
        );
        $statement->execute(['name' => $name, 'city' => $city, 'phone' => $phone]);
        return ['id' => (int) $this->app->db()->pdo()->lastInsertId()];
    }

    public function pageView(Request $request): array
    {
        $this->app->rateLimiter()->enforce(
            'page-view',
            $this->app->rateLimiter()->ipKey($request->clientIp()),
            60,
            60
        );
        $input = $request->body();
        if (!is_string($input['page_path'] ?? null) || !is_string($input['visitor_id'] ?? null)) throw new HttpException(422, 'validation_failed', 'Некорректные данные');
        $path = '/' . ltrim($input['page_path'], '/');
        $path = (string) (parse_url($path, PHP_URL_PATH) ?: '/');
        $validPath = preg_match('#^/(?:$|repertoire(?:/[a-z0-9-]{1,180})?|articles(?:/[a-z0-9-]{1,180})?|afisha|faq|franchise)$#', $path) === 1;
        if (!$validPath || strlen($path) > 255) {
            throw new HttpException(422, 'validation_failed', 'Некорректный путь', ['page_path' => 'Некорректный путь']);
        }
        $hash = $this->visitorHash((string) ($input['visitor_id'] ?? ''));
        $moscowDate = (new DateTimeImmutable('now', new DateTimeZone('Europe/Moscow')))->format('Y-m-d');
        $this->app->db()->transaction(function (\PDO $pdo) use ($moscowDate, $hash, $path): void {
            $visitor = $pdo->prepare(
                'INSERT IGNORE INTO daily_visitors (visit_date, visitor_hash, created_at)
                 VALUES (:visit_date, :visitor_hash, UTC_TIMESTAMP())'
            );
            $visitor->execute(['visit_date' => $moscowDate, 'visitor_hash' => $hash]);
            $view = $pdo->prepare(
                'INSERT INTO page_views (page_path, visitor_hash, viewed_at)
                 VALUES (:page_path, :visitor_hash, UTC_TIMESTAMP())'
            );
            $view->execute(['page_path' => $path, 'visitor_hash' => $hash]);
        });
        return ['recorded' => true];
    }

    public function ticketClick(Request $request): array
    {
        $this->app->rateLimiter()->enforce(
            'ticket-click',
            $this->app->rateLimiter()->ipKey($request->clientIp()),
            20,
            60
        );
        $input = $request->body();
        $eventId = filter_var($input['event_id'] ?? null, FILTER_VALIDATE_INT);
        if (!is_string($input['visitor_id'] ?? null)) throw new HttpException(422, 'validation_failed', 'Некорректный идентификатор посетителя');
        if ($eventId === false || $eventId < 1) {
            throw new HttpException(422, 'validation_failed', 'Некорректное событие', ['event_id' => 'Обязательное поле']);
        }
        $exists = $this->app->db()->pdo()->prepare('SELECT id FROM events WHERE id = :id');
        $exists->execute(['id' => $eventId]);
        if ($exists->fetchColumn() === false) {
            throw new HttpException(404, 'not_found', 'Событие не найдено');
        }
        $hash = $this->visitorHash((string) ($input['visitor_id'] ?? ''));
        $insert = $this->app->db()->pdo()->prepare(
            'INSERT INTO ticket_clicks (event_id, visitor_hash, clicked_at)
             VALUES (:event_id, :visitor_hash, UTC_TIMESTAMP())'
        );
        $insert->execute(['event_id' => $eventId, 'visitor_hash' => $hash]);
        return ['recorded' => true];
    }

    private function performanceSummary(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'slug' => (string) $row['slug'],
            'title' => (string) $row['title'],
            'short_description' => (string) $row['short_description'],
            'cover_image' => (string) $row['cover_image'],
            'is_premiere' => (bool) $row['is_premiere'],
        ];
    }

    private function articleSummary(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'slug' => (string) $row['slug'],
            'title' => (string) $row['title'],
            'excerpt' => (string) $row['excerpt'],
            'cover_image' => (string) $row['cover_image'],
            'published_on' => (string) $row['published_on'],
        ];
    }

    private function store(): SeoStore
    {
        return new SeoStore($this->app->db()->pdo());
    }

    /** Default alt of a performance photo: «Название — фото N». */
    private function photoAlt(string $title, int $number): string
    {
        return trim($title) . ' — фото ' . $number;
    }

    private function moscowToday(): string
    {
        return (new DateTimeImmutable('now', new DateTimeZone('Europe/Moscow')))->format('Y-m-d');
    }

    private function visitorHash(string $visitorId): string
    {
        if (preg_match('/^[a-zA-Z0-9_-]{16,128}$/', $visitorId) !== 1) {
            throw new HttpException(422, 'validation_failed', 'Некорректный идентификатор посетителя');
        }
        $secret = (string) $this->app->config['secrets']['visitor_hash'];
        if ($secret === '') {
            throw new \RuntimeException('VISITOR_HASH_SECRET is required.');
        }
        return hash_hmac('sha256', $visitorId, $secret);
    }
}
