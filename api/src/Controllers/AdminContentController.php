<?php
declare(strict_types=1);

namespace Theatre\Controllers;

use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Theatre\Core\App;
use Theatre\Core\HttpException;
use Theatre\Core\Markdown;
use Theatre\Core\PerformanceCategories;
use Theatre\Core\Request;
use Theatre\Core\Slugger;
use Theatre\Core\Validator;

final class AdminContentController
{
    public function __construct(private readonly App $app)
    {
    }

    public function performances(Request $request): array
    {
        $this->guard($request);
        $rows = $this->app->db()->pdo()->query(
            'SELECT p.*,
                    (SELECT COUNT(*) FROM events e WHERE e.performance_id = p.id) AS events_count
             FROM performances p ORDER BY p.sort_order ASC, p.id ASC'
        )->fetchAll();
        $categories = PerformanceCategories::load($this->app->db()->pdo());
        return array_map(fn (array $row): array => $this->mapPerformance($row, $categories[(int) $row['id']] ?? []), $rows);
    }

    public function createPerformance(Request $request): array
    {
        $this->guard($request);
        $input = $request->body();
        $values = $this->performanceValues($input);
        $files = $request->files();
        if (!$this->hasFile($files, 'cover_image') || !$this->hasFile($files, 'hero_image')) {
            throw new HttpException(422, 'validation_failed', 'Обложка и Hero обязательны', [
                'cover_image' => 'Обложка обязательна',
                'hero_image' => 'Hero обязателен',
            ]);
        }

        $created = [];
        try {
            $id = $this->app->db()->transaction(function (PDO $pdo) use ($values, $files, &$created): int {
                $slug = $this->uniqueSlug($values['title']);
                $sortOrder = (int) $pdo->query('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM performances')->fetchColumn();
                $insert = $pdo->prepare(
                    'INSERT INTO performances
                     (slug, title, short_description, description, cover_image, hero_image,
                      hero_focus_desktop_x, hero_focus_desktop_y, hero_focus_mobile_x, hero_focus_mobile_y,
                      is_premiere, sort_order, created_at, updated_at)
                     VALUES
                     (:slug, :title, :short_description, :description, \'\', \'\',
                      :fdx, :fdy, :fmx, :fmy, :is_premiere, :sort_order, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
                );
                $insert->execute([
                    'slug' => $slug,
                    'title' => $values['title'],
                    'short_description' => $values['short_description'],
                    'description' => $values['description'],
                    'fdx' => $values['hero_focus_desktop_x'],
                    'fdy' => $values['hero_focus_desktop_y'],
                    'fmx' => $values['hero_focus_mobile_x'],
                    'fmy' => $values['hero_focus_mobile_y'],
                    'is_premiere' => $values['is_premiere'] ? 1 : 0,
                    'sort_order' => $sortOrder,
                ]);
                $id = (int) $pdo->lastInsertId();
                $cover = $this->app->upload()->store($files['cover_image'], 'performances/' . $id, 2000);
                $created[] = $cover;
                $hero = $this->app->upload()->store($files['hero_image'], 'performances/' . $id, 2560);
                $created[] = $hero;
                $update = $pdo->prepare(
                    'UPDATE performances SET cover_image = :cover, hero_image = :hero WHERE id = :id'
                );
                $update->execute(['cover' => $cover, 'hero' => $hero, 'id' => $id]);
                PerformanceCategories::save($pdo, $id, $values['categories'] ?? []);
                return $id;
            });
        } catch (\Throwable $error) {
            foreach ($created as $path) {
                $this->app->upload()->delete($path);
            }
            throw $error;
        }
        return $this->getPerformance($id);
    }

    public function updatePerformance(Request $request, int $id): array
    {
        $this->guard($request);
        $current = $this->performanceRow($id);
        $values = $this->performanceValues($request->body());
        $files = $request->files();
        $newCover = null;
        $newHero = null;
        try {
            if ($this->hasFile($files, 'cover_image')) {
                $newCover = $this->app->upload()->store($files['cover_image'], 'performances/' . $id, 2000);
            }
            if ($this->hasFile($files, 'hero_image')) {
                $newHero = $this->app->upload()->store($files['hero_image'], 'performances/' . $id, 2560);
            }
            $statement = $this->app->db()->pdo()->prepare(
                'UPDATE performances SET
                    title = :title, short_description = :short_description, description = :description,
                    cover_image = :cover_image, hero_image = :hero_image,
                    hero_focus_desktop_x = :fdx, hero_focus_desktop_y = :fdy,
                    hero_focus_mobile_x = :fmx, hero_focus_mobile_y = :fmy,
                    is_premiere = :is_premiere, updated_at = UTC_TIMESTAMP()
                 WHERE id = :id'
            );
            $statement->execute([
                'title' => $values['title'],
                'short_description' => $values['short_description'],
                'description' => $values['description'],
                'cover_image' => $newCover ?? $current['cover_image'],
                'hero_image' => $newHero ?? $current['hero_image'],
                'fdx' => $values['hero_focus_desktop_x'],
                'fdy' => $values['hero_focus_desktop_y'],
                'fmx' => $values['hero_focus_mobile_x'],
                'fmy' => $values['hero_focus_mobile_y'],
                'is_premiere' => $values['is_premiere'] ? 1 : 0,
                'id' => $id,
            ]);
            if ($values['categories'] !== null) {
                $this->app->db()->transaction(static fn (PDO $pdo) => PerformanceCategories::save($pdo, $id, $values['categories']));
            }
        } catch (\Throwable $error) {
            $this->app->upload()->delete($newCover);
            $this->app->upload()->delete($newHero);
            throw $error;
        }
        if ($newCover !== null) {
            $this->app->upload()->delete((string) $current['cover_image']);
        }
        if ($newHero !== null) {
            $this->app->upload()->delete((string) $current['hero_image']);
        }
        return $this->getPerformance($id);
    }

    public function replacePerformanceImage(Request $request, int $id, string $kind): array
    {
        $this->guard($request);
        if (!in_array($kind, ['cover', 'hero'], true)) {
            throw new HttpException(404, 'not_found', 'Ресурс не найден');
        }
        $current = $this->performanceRow($id);
        $files = $request->files();
        if (!$this->hasFile($files, 'image')) {
            throw new HttpException(422, 'validation_failed', 'Изображение обязательно', ['image' => 'Обязательное поле']);
        }
        $column = $kind === 'cover' ? 'cover_image' : 'hero_image';
        $new = $this->app->upload()->store($files['image'], 'performances/' . $id, $kind === 'cover' ? 2000 : 2560);
        try {
            $statement = $this->app->db()->pdo()->prepare(
                "UPDATE performances SET {$column} = :image, updated_at = UTC_TIMESTAMP() WHERE id = :id"
            );
            $statement->execute(['image' => $new, 'id' => $id]);
        } catch (\Throwable $error) {
            $this->app->upload()->delete($new);
            throw $error;
        }
        $this->app->upload()->delete((string) $current[$column]);
        return $this->getPerformance($id);
    }

    public function deletePerformance(Request $request, int $id): array
    {
        $this->guard($request);
        $current = $this->performanceRow($id);
        $linked = $this->app->db()->pdo()->prepare('SELECT COUNT(*) FROM events WHERE performance_id = :id');
        $linked->execute(['id' => $id]);
        if ((int) $linked->fetchColumn() > 0) {
            throw new HttpException(409, 'performance_has_events', 'Сначала удалите связанные события');
        }
        $delete = $this->app->db()->pdo()->prepare('DELETE FROM performances WHERE id = :id');
        $delete->execute(['id' => $id]);
        $this->app->upload()->delete((string) $current['cover_image']);
        $this->app->upload()->delete((string) $current['hero_image']);
        return ['deleted' => true];
    }

    public function reorderPerformances(Request $request): array
    {
        $this->guard($request);
        $ids = $this->validatedIds($request->body()['ids'] ?? null, 'performances');
        $this->app->db()->transaction(static function (PDO $pdo) use ($ids): void {
            $update = $pdo->prepare('UPDATE performances SET sort_order = :sort_order, updated_at = UTC_TIMESTAMP() WHERE id = :id');
            foreach ($ids as $index => $id) {
                $update->execute(['sort_order' => $index + 1, 'id' => $id]);
            }
        });
        return ['reordered' => true];
    }

    public function events(Request $request): array
    {
        $this->guard($request);
        $rows = $this->app->db()->pdo()->query(
            'SELECT e.*, p.title AS performance_title, p.slug AS performance_slug
             FROM events e INNER JOIN performances p ON p.id = e.performance_id
             ORDER BY e.event_date ASC, e.event_time IS NULL ASC, e.event_time ASC, e.id ASC'
        )->fetchAll();
        return array_map([$this, 'mapEvent'], $rows);
    }

    public function createEvent(Request $request): array
    {
        $this->guard($request);
        $values = $this->eventValues($request->body(), true);
        $files = $request->files();
        if (!$this->hasFile($files, 'poster_image')) {
            throw new HttpException(422, 'validation_failed', 'Постер обязателен', ['poster_image' => 'Постер обязателен']);
        }
        $created = null;
        try {
            $id = $this->app->db()->transaction(function (PDO $pdo) use ($values, $files, &$created): int {
                $insert = $pdo->prepare(
                    'INSERT INTO events
                     (performance_id, event_date, event_time, venue, poster_image, ticket_url, created_at, updated_at)
                     VALUES (:performance_id, :event_date, :event_time, :venue, \'\', :ticket_url, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
                );
                $insert->execute($values);
                $id = (int) $pdo->lastInsertId();
                $created = $this->app->upload()->store($files['poster_image'], 'events/' . $id, 2000);
                $update = $pdo->prepare('UPDATE events SET poster_image = :poster WHERE id = :id');
                $update->execute(['poster' => $created, 'id' => $id]);
                return $id;
            });
        } catch (\Throwable $error) {
            $this->app->upload()->delete($created);
            throw $error;
        }
        return $this->getEvent($id);
    }

    public function updateEvent(Request $request, int $id): array
    {
        $this->guard($request);
        $current = $this->eventRow($id);
        // Older admin builds omit the field; do not erase an already saved time.
        $values = $this->eventValues(array_merge([
            'event_time' => $current['event_time'] === null ? null : substr((string) $current['event_time'], 0, 5),
        ], $request->body()), false);
        $files = $request->files();
        $newPoster = null;
        try {
            if ($this->hasFile($files, 'poster_image')) {
                $newPoster = $this->app->upload()->store($files['poster_image'], 'events/' . $id, 2000);
            }
            $statement = $this->app->db()->pdo()->prepare(
                'UPDATE events SET performance_id = :performance_id, event_date = :event_date, event_time = :event_time,
                    venue = :venue, poster_image = :poster_image, ticket_url = :ticket_url,
                    updated_at = UTC_TIMESTAMP() WHERE id = :id'
            );
            $statement->execute(array_merge($values, [
                'poster_image' => $newPoster ?? $current['poster_image'],
                'id' => $id,
            ]));
        } catch (\Throwable $error) {
            $this->app->upload()->delete($newPoster);
            throw $error;
        }
        if ($newPoster !== null) {
            $this->app->upload()->delete((string) $current['poster_image']);
        }
        return $this->getEvent($id);
    }

    public function replaceEventPoster(Request $request, int $id): array
    {
        $this->guard($request);
        $current = $this->eventRow($id);
        $files = $request->files();
        if (!$this->hasFile($files, 'image')) {
            throw new HttpException(422, 'validation_failed', 'Постер обязателен', ['image' => 'Обязательное поле']);
        }
        $new = $this->app->upload()->store($files['image'], 'events/' . $id, 2000);
        try {
            $update = $this->app->db()->pdo()->prepare(
                'UPDATE events SET poster_image = :poster, updated_at = UTC_TIMESTAMP() WHERE id = :id'
            );
            $update->execute(['poster' => $new, 'id' => $id]);
        } catch (\Throwable $error) {
            $this->app->upload()->delete($new);
            throw $error;
        }
        $this->app->upload()->delete((string) $current['poster_image']);
        return $this->getEvent($id);
    }

    public function deleteEvent(Request $request, int $id): array
    {
        $this->guard($request);
        $current = $this->eventRow($id);
        $delete = $this->app->db()->pdo()->prepare('DELETE FROM events WHERE id = :id');
        $delete->execute(['id' => $id]);
        $this->app->upload()->delete((string) $current['poster_image']);
        return ['deleted' => true];
    }

    public function faq(Request $request): array
    {
        $this->guard($request);
        return array_map([$this, 'mapFaq'], $this->app->db()->pdo()->query(
            'SELECT * FROM faq ORDER BY sort_order ASC, id ASC'
        )->fetchAll());
    }

    public function createFaq(Request $request): array
    {
        $this->guard($request);
        $values = $this->faqValues($request->body());
        $sortOrder = (int) $this->app->db()->pdo()->query('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM faq')->fetchColumn();
        $insert = $this->app->db()->pdo()->prepare(
            'INSERT INTO faq (question, answer, sort_order, created_at, updated_at)
             VALUES (:question, :answer, :sort_order, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        );
        $insert->execute(array_merge($values, ['sort_order' => $sortOrder]));
        return $this->getFaq((int) $this->app->db()->pdo()->lastInsertId());
    }

    public function updateFaq(Request $request, int $id): array
    {
        $this->guard($request);
        $this->faqRow($id);
        $values = $this->faqValues($request->body());
        $update = $this->app->db()->pdo()->prepare(
            'UPDATE faq SET question = :question, answer = :answer, updated_at = UTC_TIMESTAMP() WHERE id = :id'
        );
        $update->execute(array_merge($values, ['id' => $id]));
        return $this->getFaq($id);
    }

    public function deleteFaq(Request $request, int $id): array
    {
        $this->guard($request);
        $this->faqRow($id);
        $delete = $this->app->db()->pdo()->prepare('DELETE FROM faq WHERE id = :id');
        $delete->execute(['id' => $id]);
        return ['deleted' => true];
    }

    public function reorderFaq(Request $request): array
    {
        $this->guard($request);
        $ids = $this->validatedIds($request->body()['ids'] ?? null, 'faq');
        $this->app->db()->transaction(static function (PDO $pdo) use ($ids): void {
            $update = $pdo->prepare('UPDATE faq SET sort_order = :sort_order, updated_at = UTC_TIMESTAMP() WHERE id = :id');
            foreach ($ids as $index => $id) {
                $update->execute(['sort_order' => $index + 1, 'id' => $id]);
            }
        });
        return ['reordered' => true];
    }

    private function guard(Request $request): array
    {
        $admin = $this->app->auth()->requireAdmin($request->bearerToken());
        $this->app->rateLimiter()->enforce('admin-api', 'admin-' . $admin['id'], 120, 60);
        return $admin;
    }

    private function performanceValues(array $input): array
    {
        $input += ['hero_focus_desktop_x' => 50, 'hero_focus_desktop_y' => 50, 'hero_focus_mobile_x' => 50, 'hero_focus_mobile_y' => 50];
        $errors = [];
        if (isset($input['is_premiere']) && !in_array($input['is_premiere'], [true, false, 1, 0, '1', '0', 'true', 'false', 'on'], true)) $errors['is_premiere'] = 'Ожидается логическое значение';
        $title = Validator::text($input, 'title', 2, 150, $errors);
        $short = Validator::text($input, 'short_description', 20, 500, $errors);
        $description = Validator::text($input, 'description', 50, 20000, $errors);
        $this->plain($title, 'title', $errors);
        $this->plain($short, 'short_description', $errors);
        Markdown::validate($description, 'description', $errors);
        $values = [
            'title' => $title,
            'short_description' => $short,
            'description' => $description,
            'hero_focus_desktop_x' => Validator::integer($input, 'hero_focus_desktop_x', 0, 100, $errors),
            'hero_focus_desktop_y' => Validator::integer($input, 'hero_focus_desktop_y', 0, 100, $errors),
            'hero_focus_mobile_x' => Validator::integer($input, 'hero_focus_mobile_x', 0, 100, $errors),
            'hero_focus_mobile_y' => Validator::integer($input, 'hero_focus_mobile_y', 0, 100, $errors),
            'is_premiere' => Validator::boolean($input, 'is_premiere'),
            'categories' => PerformanceCategories::parse($input, $errors),
        ];
        Validator::throwIfErrors($errors);
        return $values;
    }

    private function eventValues(array $input, bool $creating): array
    {
        $errors = [];
        $performanceId = filter_var($input['performance_id'] ?? null, FILTER_VALIDATE_INT);
        if ($performanceId === false || $performanceId < 1) {
            $errors['performance_id'] = 'Выберите спектакль';
            $performanceId = 0;
        } else {
            $exists = $this->app->db()->pdo()->prepare('SELECT id FROM performances WHERE id = :id');
            $exists->execute(['id' => $performanceId]);
            if ($exists->fetchColumn() === false) {
                $errors['performance_id'] = 'Спектакль не найден';
            }
        }
        $eventDate = Validator::date($input, 'event_date', $errors);
        $eventTime = Validator::time($input, 'event_time', $errors);
        if ($creating && !isset($errors['event_date'])) {
            $today = (new DateTimeImmutable('now', new DateTimeZone('Europe/Moscow')))->format('Y-m-d');
            if ($eventDate < $today) {
                $errors['event_date'] = 'Нельзя создать событие в прошлом';
            }
        }
        $venue = Validator::text($input, 'venue', 2, 200, $errors);
        $this->plain($venue, 'venue', $errors);
        $ticketUrl = Validator::url($input, 'ticket_url', $errors);
        Validator::throwIfErrors($errors);
        return [
            'performance_id' => (int) $performanceId,
            'event_date' => $eventDate,
            'event_time' => $eventTime,
            'venue' => $venue,
            'ticket_url' => $ticketUrl,
        ];
    }

    private function faqValues(array $input): array
    {
        $errors = [];
        $question = Validator::text($input, 'question', 3, 300, $errors);
        $answer = Validator::text($input, 'answer', 10, 10000, $errors);
        $this->plain($question, 'question', $errors);
        Markdown::validate($answer, 'answer', $errors);
        Validator::throwIfErrors($errors);
        return ['question' => $question, 'answer' => $answer];
    }

    private function plain(string $value, string $field, array &$errors): void
    {
        if ($value !== strip_tags($value) || preg_match('/[*_`\[\]{}<>]/u', $value) === 1) {
            $errors[$field] = 'Допустим только обычный текст';
        }
    }

    private function uniqueSlug(string $title): string
    {
        $base = Slugger::make($title);
        $slug = $base;
        $suffix = 2;
        $statement = $this->app->db()->pdo()->prepare('SELECT 1 FROM performances WHERE slug = :slug');
        while (true) {
            $statement->execute(['slug' => $slug]);
            if ($statement->fetchColumn() === false) {
                return $slug;
            }
            $suffixText = '-' . $suffix++;
            $slug = substr($base, 0, 180 - strlen($suffixText)) . $suffixText;
        }
    }

    private function validatedIds(mixed $value, string $table): array
    {
        if (!is_array($value) || $value === []) {
            throw new HttpException(422, 'validation_failed', 'Некорректный порядок', ['ids' => 'Передайте все идентификаторы']);
        }
        $ids = array_values(array_map('intval', $value));
        if (in_array(0, $ids, true) || count($ids) !== count(array_unique($ids))) {
            throw new HttpException(422, 'validation_failed', 'Некорректный порядок', ['ids' => 'Идентификаторы должны быть уникальны']);
        }
        $allowed = ['performances', 'faq'];
        if (!in_array($table, $allowed, true)) {
            throw new \RuntimeException('Unsafe reorder table.');
        }
        $existing = array_map('intval', $this->app->db()->pdo()->query("SELECT id FROM {$table} ORDER BY id")->fetchAll(PDO::FETCH_COLUMN));
        $sortedIds = $ids;
        sort($sortedIds);
        sort($existing);
        if ($sortedIds !== $existing) {
            throw new HttpException(409, 'stale_order', 'Список изменился. Обновите данные и повторите.');
        }
        return $ids;
    }

    private function hasFile(array $files, string $field): bool
    {
        return isset($files[$field]) && (int) ($files[$field]['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
    }

    private function performanceRow(int $id): array
    {
        $statement = $this->app->db()->pdo()->prepare('SELECT * FROM performances WHERE id = :id');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            throw new HttpException(404, 'not_found', 'Спектакль не найден');
        }
        return $row;
    }

    private function getPerformance(int $id): array
    {
        return $this->mapPerformance($this->performanceRow($id), PerformanceCategories::load($this->app->db()->pdo(), $id)[$id] ?? []);
    }

    private function mapPerformance(array $row, array $categories = []): array
    {
        $row['categories'] = $categories;
        foreach (['id', 'sort_order', 'hero_focus_desktop_x', 'hero_focus_desktop_y', 'hero_focus_mobile_x', 'hero_focus_mobile_y', 'events_count'] as $field) {
            if (array_key_exists($field, $row)) {
                $row[$field] = (int) $row[$field];
            }
        }
        $row['is_premiere'] = (bool) $row['is_premiere'];
        return $row;
    }

    private function eventRow(int $id): array
    {
        $statement = $this->app->db()->pdo()->prepare('SELECT * FROM events WHERE id = :id');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            throw new HttpException(404, 'not_found', 'Событие не найдено');
        }
        return $row;
    }

    private function getEvent(int $id): array
    {
        $statement = $this->app->db()->pdo()->prepare(
            'SELECT e.*, p.title AS performance_title, p.slug AS performance_slug
             FROM events e INNER JOIN performances p ON p.id = e.performance_id WHERE e.id = :id'
        );
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            throw new HttpException(404, 'not_found', 'Событие не найдено');
        }
        return $this->mapEvent($row);
    }

    private function mapEvent(array $row): array
    {
        $row['id'] = (int) $row['id'];
        $row['performance_id'] = (int) $row['performance_id'];
        $row['event_time'] = $row['event_time'] === null ? null : substr((string) $row['event_time'], 0, 5);
        $moscowToday = (new DateTimeImmutable('now', new DateTimeZone('Europe/Moscow')))->format('Y-m-d');
        $row['is_past'] = (string) $row['event_date'] < $moscowToday;
        return $row;
    }

    private function faqRow(int $id): array
    {
        $statement = $this->app->db()->pdo()->prepare('SELECT * FROM faq WHERE id = :id');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            throw new HttpException(404, 'not_found', 'Вопрос не найден');
        }
        return $row;
    }

    private function getFaq(int $id): array
    {
        return $this->mapFaq($this->faqRow($id));
    }

    private function mapFaq(array $row): array
    {
        $row['id'] = (int) $row['id'];
        $row['sort_order'] = (int) $row['sort_order'];
        return $row;
    }
}
