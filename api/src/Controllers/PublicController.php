<?php
declare(strict_types=1);

namespace Theatre\Controllers;

use DateTimeImmutable;
use DateTimeZone;
use Theatre\Core\App;
use Theatre\Core\HttpException;
use Theatre\Core\Request;
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
        return array_map([$this, 'performanceSummary'], $rows);
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
        return [
            'id' => (int) $row['id'],
            'slug' => (string) $row['slug'],
            'title' => (string) $row['title'],
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
                    p.slug, p.title, p.is_premiere
             FROM events e
             INNER JOIN performances p ON p.id = e.performance_id
             WHERE e.event_date >= :today
             ORDER BY e.event_date ASC, e.event_time IS NULL ASC, e.event_time ASC, e.id ASC'
        );
        $statement->execute(['today' => $today]);
        return array_map(static fn (array $row): array => [
            'id' => (int) $row['id'],
            'event_date' => (string) $row['event_date'],
            'event_time' => $row['event_time'] === null ? null : substr((string) $row['event_time'], 0, 5),
            'venue' => (string) $row['venue'],
            'poster_image' => (string) $row['poster_image'],
            'ticket_url' => (string) $row['ticket_url'],
            'performance' => [
                'slug' => (string) $row['slug'],
                'title' => (string) $row['title'],
                'is_premiere' => (bool) $row['is_premiere'],
            ],
        ], $statement->fetchAll());
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
        return array_map([$this, 'articleSummary'], $statement->fetchAll());
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
        return $this->articleSummary($row) + ['body' => (string) $row['body'], 'updated_at' => (string) $row['updated_at']];
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
