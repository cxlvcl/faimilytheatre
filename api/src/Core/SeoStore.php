<?php
declare(strict_types=1);

namespace Theatre\Core;

use PDO;

/**
 * Storage for the fields editors fill in themselves (owner's SEO spec): page SEO, image alt
 * texts, «Вопросы и ответы», performance/article details, venues, links, redirects, settings.
 * Public reads survive a database without the 005 tables (the site keeps its defaults).
 */
final class SeoStore
{
    public const STATIC_PAGES = ['/', '/repertoire', '/afisha', '/articles', '/faq', '/franchise'];
    public const AGE_RATINGS = ['0+', '3+', '6+', '12+', '16+'];
    public const SETTINGS = [
        'metrika_id' => '',
        'vk_pixel_id' => '',
        'head_code' => '',
        'verification_yandex' => '',
        'verification_google' => '',
        'verification_vk' => '',
        'robots_txt' => '',
        'org_name' => 'Театр Музыки и Песка',
        'org_description' => 'Живая музыка, художественное слово и песочная анимация.',
        'org_phones' => "+7 (831) 423-58-04\n+7 (929) 053-58-04",
        'org_email' => 'info@teatrmip-nn.ru',
        'org_city' => 'Нижний Новгород',
        'org_vk' => 'https://vk.ru/lmtales',
        'org_telegram' => 'https://t.me/dobrohot_art',
        'org_yandex_maps' => '',
    ];

    private ?array $settings = null;

    public function __construct(private readonly PDO $pdo)
    {
    }

    /** Runs a public read; a missing table (SQL not imported yet) yields the fallback. */
    public static function safe(callable $read, mixed $fallback): mixed
    {
        try {
            return $read();
        } catch (\PDOException $error) {
            if (in_array((string) $error->getCode(), ['42S02', '42S22'], true)) return $fallback;
            throw $error;
        }
    }

    // ---------- Settings ----------

    public function settings(): array
    {
        if ($this->settings !== null) return $this->settings;
        $stored = self::safe(fn () => $this->pdo->query('SELECT name, value FROM site_settings')->fetchAll(PDO::FETCH_KEY_PAIR), []);
        $values = self::SETTINGS;
        foreach ($stored as $name => $value) if (array_key_exists($name, $values)) $values[$name] = (string) $value;
        return $this->settings = $values;
    }

    public function saveSettings(array $values): void
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO site_settings (name, value, updated_at) VALUES (:name, :value, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)'
        );
        foreach ($values as $name => $value) {
            if (!array_key_exists($name, self::SETTINGS)) continue;
            $statement->execute(['name' => $name, 'value' => (string) $value]);
        }
        $this->settings = null;
    }

    // ---------- SEO meta ----------

    public function meta(string $type, string $key): ?array
    {
        return self::safe(function () use ($type, $key): ?array {
            $statement = $this->pdo->prepare('SELECT * FROM seo_meta WHERE target_type = :type AND target_key = :key');
            $statement->execute(['type' => $type, 'key' => $key]);
            $row = $statement->fetch();
            return is_array($row) ? self::mapMeta($row) : null;
        }, null);
    }

    /** @return array<string, array> target_key => meta */
    public function metaMap(string $type): array
    {
        return self::safe(function () use ($type): array {
            $statement = $this->pdo->prepare('SELECT * FROM seo_meta WHERE target_type = :type');
            $statement->execute(['type' => $type]);
            $map = [];
            foreach ($statement->fetchAll() as $row) $map[(string) $row['target_key']] = self::mapMeta($row);
            return $map;
        }, []);
    }

    /** @return list<string> keys marked «Не индексировать» */
    public function noindexKeys(string $type): array
    {
        return array_keys(array_filter($this->metaMap($type), static fn (array $meta): bool => $meta['noindex']));
    }

    public function saveMeta(string $type, string $key, array $values): void
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO seo_meta (target_type, target_key, title, description, h1, canonical, noindex, og_title, og_description, og_image, og_image_width, og_image_height, updated_at)
             VALUES (:type, :key, :title, :description, :h1, :canonical, :noindex, :og_title, :og_description, :og_image, :og_image_width, :og_image_height, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description), h1 = VALUES(h1), canonical = VALUES(canonical),
                noindex = VALUES(noindex), og_title = VALUES(og_title), og_description = VALUES(og_description), og_image = VALUES(og_image),
                og_image_width = VALUES(og_image_width), og_image_height = VALUES(og_image_height), updated_at = VALUES(updated_at)'
        );
        $statement->execute([
            'type' => $type, 'key' => $key,
            'title' => $values['title'], 'description' => $values['description'], 'h1' => $values['h1'],
            'canonical' => $values['canonical'], 'noindex' => $values['noindex'] ? 1 : 0,
            'og_title' => $values['og_title'], 'og_description' => $values['og_description'],
            'og_image' => $values['og_image'], 'og_image_width' => $values['og_image_width'], 'og_image_height' => $values['og_image_height'],
        ]);
    }

    public function deleteMeta(string $type, string $key): void
    {
        $statement = $this->pdo->prepare('DELETE FROM seo_meta WHERE target_type = :type AND target_key = :key');
        $statement->execute(['type' => $type, 'key' => $key]);
    }

    public static function emptyMeta(): array
    {
        return ['title' => '', 'description' => '', 'h1' => '', 'canonical' => '', 'noindex' => false, 'og_title' => '', 'og_description' => '', 'og_image' => '', 'og_image_width' => null, 'og_image_height' => null, 'updated_at' => null];
    }

    private static function mapMeta(array $row): array
    {
        return [
            'title' => (string) $row['title'], 'description' => (string) $row['description'], 'h1' => (string) $row['h1'],
            'canonical' => (string) $row['canonical'], 'noindex' => (bool) $row['noindex'],
            'og_title' => (string) $row['og_title'], 'og_description' => (string) $row['og_description'], 'og_image' => (string) $row['og_image'],
            'og_image_width' => $row['og_image_width'] === null ? null : (int) $row['og_image_width'],
            'og_image_height' => $row['og_image_height'] === null ? null : (int) $row['og_image_height'],
            'updated_at' => (string) $row['updated_at'],
        ];
    }

    // ---------- Image alt texts ----------

    /** @return array<string, string> field => alt */
    public function alts(string $type, int $id): array
    {
        return $this->altsMap($type, [$id])[$id] ?? [];
    }

    /** @return array<int, array<string, string>> */
    public function altsMap(string $type, ?array $ids = null): array
    {
        return self::safe(function () use ($type, $ids): array {
            $sql = 'SELECT target_id, field, alt FROM image_alts WHERE target_type = ?';
            $params = [$type];
            if ($ids !== null) {
                if ($ids === []) return [];
                $sql .= ' AND target_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')';
                array_push($params, ...array_map('intval', $ids));
            }
            $statement = $this->pdo->prepare($sql);
            $statement->execute($params);
            $map = [];
            foreach ($statement->fetchAll() as $row) $map[(int) $row['target_id']][(string) $row['field']] = (string) $row['alt'];
            return $map;
        }, []);
    }

    /** @param array<string, string> $alts empty value removes the alt */
    public function saveAlts(string $type, int $id, array $alts): void
    {
        $upsert = $this->pdo->prepare(
            'INSERT INTO image_alts (target_type, target_id, field, alt) VALUES (:type, :id, :field, :alt)
             ON DUPLICATE KEY UPDATE alt = VALUES(alt)'
        );
        $delete = $this->pdo->prepare('DELETE FROM image_alts WHERE target_type = :type AND target_id = :id AND field = :field');
        foreach ($alts as $field => $alt) {
            if ($alt === '') $delete->execute(['type' => $type, 'id' => $id, 'field' => $field]);
            else $upsert->execute(['type' => $type, 'id' => $id, 'field' => $field, 'alt' => $alt]);
        }
    }

    public function deleteAlts(string $type, int $id): void
    {
        $statement = $this->pdo->prepare('DELETE FROM image_alts WHERE target_type = :type AND target_id = :id');
        $statement->execute(['type' => $type, 'id' => $id]);
    }

    // ---------- «Вопросы и ответы» ----------

    /** @return list<array{question:string, answer:string}> the item's own pairs */
    public function faq(string $type, int $id): array
    {
        return self::safe(function () use ($type, $id): array {
            $statement = $this->pdo->prepare('SELECT question, answer FROM content_faq WHERE target_type = :type AND target_id = :id ORDER BY sort_order, id');
            $statement->execute(['type' => $type, 'id' => $id]);
            return array_map(static fn (array $row): array => ['question' => (string) $row['question'], 'answer' => (string) $row['answer']], $statement->fetchAll());
        }, []);
    }

    /** @return list<int> */
    public function sharedFaqIds(string $type, int $id): array
    {
        return self::safe(function () use ($type, $id): array {
            $statement = $this->pdo->prepare('SELECT faq_id FROM content_faq_shared WHERE target_type = :type AND target_id = :id ORDER BY faq_id');
            $statement->execute(['type' => $type, 'id' => $id]);
            return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
        }, []);
    }

    /** @return array<int, list<array{question:string, answer:string}>> */
    public function faqMap(string $type): array
    {
        return self::safe(function () use ($type): array {
            $statement = $this->pdo->prepare('SELECT target_id, question, answer FROM content_faq WHERE target_type = :type ORDER BY target_id, sort_order, id');
            $statement->execute(['type' => $type]);
            $map = [];
            foreach ($statement->fetchAll() as $row) $map[(int) $row['target_id']][] = ['question' => (string) $row['question'], 'answer' => (string) $row['answer']];
            return $map;
        }, []);
    }

    /** @return array<int, list<int>> */
    public function sharedFaqMap(string $type): array
    {
        return self::safe(function () use ($type): array {
            $statement = $this->pdo->prepare('SELECT target_id, faq_id FROM content_faq_shared WHERE target_type = :type ORDER BY faq_id');
            $statement->execute(['type' => $type]);
            $map = [];
            foreach ($statement->fetchAll() as $row) $map[(int) $row['target_id']][] = (int) $row['faq_id'];
            return $map;
        }, []);
    }

    /** Own pairs first, then the attached questions from the FAQ page in that page's order. */
    public function publicFaq(string $type, int $id): array
    {
        $own = $this->faq($type, $id);
        $shared = self::safe(function () use ($type, $id): array {
            $statement = $this->pdo->prepare(
                'SELECT f.question, f.answer FROM content_faq_shared s INNER JOIN faq f ON f.id = s.faq_id
                 WHERE s.target_type = :type AND s.target_id = :id ORDER BY f.sort_order, f.id'
            );
            $statement->execute(['type' => $type, 'id' => $id]);
            return array_map(static fn (array $row): array => ['question' => (string) $row['question'], 'answer' => (string) $row['answer']], $statement->fetchAll());
        }, []);
        return [...$own, ...$shared];
    }

    public function saveFaq(string $type, int $id, array $pairs): void
    {
        $delete = $this->pdo->prepare('DELETE FROM content_faq WHERE target_type = :type AND target_id = :id');
        $delete->execute(['type' => $type, 'id' => $id]);
        $insert = $this->pdo->prepare('INSERT INTO content_faq (target_type, target_id, question, answer, sort_order) VALUES (:type, :id, :question, :answer, :sort)');
        foreach (array_values($pairs) as $index => $pair) {
            $insert->execute(['type' => $type, 'id' => $id, 'question' => $pair['question'], 'answer' => $pair['answer'], 'sort' => $index + 1]);
        }
    }

    public function saveSharedFaq(string $type, int $id, array $faqIds): void
    {
        $delete = $this->pdo->prepare('DELETE FROM content_faq_shared WHERE target_type = :type AND target_id = :id');
        $delete->execute(['type' => $type, 'id' => $id]);
        $insert = $this->pdo->prepare('INSERT INTO content_faq_shared (target_type, target_id, faq_id) VALUES (:type, :id, :faq)');
        foreach (array_unique($faqIds) as $faqId) $insert->execute(['type' => $type, 'id' => $id, 'faq' => $faqId]);
    }

    public function deleteFaqFor(string $type, int $id): void
    {
        foreach (['content_faq', 'content_faq_shared'] as $table) {
            $statement = $this->pdo->prepare("DELETE FROM {$table} WHERE target_type = :type AND target_id = :id");
            $statement->execute(['type' => $type, 'id' => $id]);
        }
    }

    // ---------- Performance details ----------

    public static function emptyDetails(): array
    {
        return ['genre' => '', 'work_author' => '', 'work_title' => '', 'alternate_names' => [], 'age_rating' => null, 'duration_min' => null, 'duration_max' => null, 'has_intermission' => false, 'price_from' => null];
    }

    /** @return array<int, array> performance id => details */
    public function performanceDetailsMap(?array $ids = null): array
    {
        return self::safe(function () use ($ids): array {
            $sql = 'SELECT * FROM performance_details';
            $params = [];
            if ($ids !== null) {
                if ($ids === []) return [];
                $sql .= ' WHERE performance_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')';
                $params = array_map('intval', $ids);
            }
            $statement = $this->pdo->prepare($sql);
            $statement->execute($params);
            $map = [];
            foreach ($statement->fetchAll() as $row) {
                $map[(int) $row['performance_id']] = [
                    'genre' => (string) $row['genre'], 'work_author' => (string) $row['work_author'], 'work_title' => (string) $row['work_title'],
                    'alternate_names' => array_values(array_filter(array_map('trim', explode("\n", (string) $row['alternate_names'])), 'strlen')),
                    'age_rating' => $row['age_rating'] === null ? null : (string) $row['age_rating'],
                    'duration_min' => $row['duration_min'] === null ? null : (int) $row['duration_min'],
                    'duration_max' => $row['duration_max'] === null ? null : (int) $row['duration_max'],
                    'has_intermission' => (bool) $row['has_intermission'],
                    'price_from' => $row['price_from'] === null ? null : (int) $row['price_from'],
                ];
            }
            return $map;
        }, []);
    }

    public function performanceDetails(int $id): array
    {
        return $this->performanceDetailsMap([$id])[$id] ?? self::emptyDetails();
    }

    public function savePerformanceDetails(int $id, array $details): void
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO performance_details (performance_id, genre, work_author, work_title, alternate_names, age_rating, duration_min, duration_max, has_intermission, price_from, updated_at)
             VALUES (:id, :genre, :work_author, :work_title, :alternate_names, :age_rating, :duration_min, :duration_max, :has_intermission, :price_from, UTC_TIMESTAMP())
             ON DUPLICATE KEY UPDATE genre = VALUES(genre), work_author = VALUES(work_author), work_title = VALUES(work_title),
                alternate_names = VALUES(alternate_names), age_rating = VALUES(age_rating), duration_min = VALUES(duration_min),
                duration_max = VALUES(duration_max), has_intermission = VALUES(has_intermission), price_from = VALUES(price_from), updated_at = VALUES(updated_at)'
        );
        $statement->execute([
            'id' => $id, 'genre' => $details['genre'], 'work_author' => $details['work_author'], 'work_title' => $details['work_title'],
            'alternate_names' => implode("\n", $details['alternate_names']), 'age_rating' => $details['age_rating'],
            'duration_min' => $details['duration_min'], 'duration_max' => $details['duration_max'],
            'has_intermission' => $details['has_intermission'] ? 1 : 0, 'price_from' => $details['price_from'],
        ]);
    }

    // ---------- Afisha: cancelled dates and venues ----------

    /** @return array<int, bool> event id => cancelled */
    public function cancelledMap(): array
    {
        return self::safe(fn () => array_map('boolval', $this->pdo->query('SELECT event_id, is_cancelled FROM event_details')->fetchAll(PDO::FETCH_KEY_PAIR)), []);
    }

    public function saveCancelled(int $eventId, bool $cancelled): void
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO event_details (event_id, is_cancelled) VALUES (:id, :cancelled) ON DUPLICATE KEY UPDATE is_cancelled = VALUES(is_cancelled)'
        );
        $statement->execute(['id' => $eventId, 'cancelled' => $cancelled ? 1 : 0]);
    }

    public function venues(): array
    {
        return self::safe(fn () => array_map(static fn (array $row): array => [
            'id' => (int) $row['id'], 'name' => (string) $row['name'], 'city' => (string) $row['city'],
            'street_address' => (string) $row['street_address'], 'postal_code' => (string) $row['postal_code'],
        ], $this->pdo->query('SELECT * FROM venues ORDER BY name')->fetchAll()), []);
    }

    /** Venue directory keyed by a normalised name: «Маяковка 10» matches «маяковка 10». */
    public function venueByName(): array
    {
        $map = [];
        foreach ($this->venues() as $venue) $map[self::venueKey($venue['name'])] = $venue;
        return $map;
    }

    public static function venueKey(string $name): string
    {
        return mb_strtolower(trim(preg_replace('/[\s«»"“”„.,]+/u', ' ', $name) ?? ''));
    }

    // ---------- Articles: author, rubric, update date; performance links ----------

    public function authors(): array
    {
        return self::safe(fn () => array_map(static fn (array $row): array => [
            'id' => (int) $row['id'], 'name' => (string) $row['name'], 'position' => (string) $row['position'], 'photo' => (string) $row['photo'],
        ], $this->pdo->query('SELECT * FROM authors ORDER BY name')->fetchAll()), []);
    }

    public function rubrics(): array
    {
        return self::safe(fn () => array_map(static fn (array $row): array => [
            'id' => (int) $row['id'], 'slug' => (string) $row['slug'], 'name' => (string) $row['name'],
        ], $this->pdo->query('SELECT * FROM article_rubrics ORDER BY sort_order, id')->fetchAll()), []);
    }

    /** @return array<int, array{author_id:?int, rubric_id:?int, updated_on:?string}> */
    public function articleDetailsMap(): array
    {
        return self::safe(function (): array {
            $map = [];
            foreach ($this->pdo->query('SELECT * FROM article_details')->fetchAll() as $row) {
                $map[(int) $row['article_id']] = [
                    'author_id' => $row['author_id'] === null ? null : (int) $row['author_id'],
                    'rubric_id' => $row['rubric_id'] === null ? null : (int) $row['rubric_id'],
                    'updated_on' => $row['updated_on'] === null ? null : (string) $row['updated_on'],
                ];
            }
            return $map;
        }, []);
    }

    public function saveArticleDetails(int $id, ?int $authorId, ?int $rubricId, ?string $updatedOn): void
    {
        $statement = $this->pdo->prepare(
            'INSERT INTO article_details (article_id, author_id, rubric_id, updated_on) VALUES (:id, :author, :rubric, :updated)
             ON DUPLICATE KEY UPDATE author_id = VALUES(author_id), rubric_id = VALUES(rubric_id), updated_on = VALUES(updated_on)'
        );
        $statement->execute(['id' => $id, 'author' => $authorId, 'rubric' => $rubricId, 'updated' => $updatedOn]);
    }

    /** @return array<int, list<int>> performance id => article ids (or the reverse with $byArticle) */
    public function links(bool $byArticle = false): array
    {
        return self::safe(function () use ($byArticle): array {
            $map = [];
            foreach ($this->pdo->query('SELECT performance_id, article_id FROM performance_articles')->fetchAll() as $row) {
                if ($byArticle) $map[(int) $row['article_id']][] = (int) $row['performance_id'];
                else $map[(int) $row['performance_id']][] = (int) $row['article_id'];
            }
            return $map;
        }, []);
    }

    /** Replaces one side of the relation: the articles of a performance, or the performances of an article. */
    public function saveLinks(string $owner, int $id, array $otherIds): void
    {
        [$column, $other] = $owner === 'performance' ? ['performance_id', 'article_id'] : ['article_id', 'performance_id'];
        $delete = $this->pdo->prepare("DELETE FROM performance_articles WHERE {$column} = :id");
        $delete->execute(['id' => $id]);
        $insert = $this->pdo->prepare("INSERT INTO performance_articles ({$column}, {$other}) VALUES (:id, :other)");
        foreach (array_unique($otherIds) as $otherId) $insert->execute(['id' => $id, 'other' => $otherId]);
    }

    // ---------- Redirects ----------

    /** @return array{to_path:string, status_code:int}|null */
    public function redirect(string $path): ?array
    {
        return self::safe(function () use ($path): ?array {
            $statement = $this->pdo->prepare('SELECT to_path, status_code FROM redirects WHERE from_path = :path');
            $statement->execute(['path' => $path]);
            $row = $statement->fetch();
            return is_array($row) ? ['to_path' => (string) $row['to_path'], 'status_code' => (int) $row['status_code']] : null;
        }, null);
    }

    public function redirects(): array
    {
        return array_map(static fn (array $row): array => [
            'id' => (int) $row['id'], 'from_path' => (string) $row['from_path'], 'to_path' => (string) $row['to_path'],
            'status_code' => (int) $row['status_code'], 'is_automatic' => (bool) $row['is_automatic'], 'created_at' => (string) $row['created_at'],
        ], $this->pdo->query('SELECT * FROM redirects ORDER BY created_at DESC, id DESC')->fetchAll());
    }

    /**
     * Saves «from → to» without chains or loops: the target is resolved to its final address,
     * and older rules that pointed at «from» are re-pointed to that final address.
     */
    public function saveRedirect(?int $id, string $from, string $to, int $code, bool $automatic): void
    {
        $final = $this->resolve($to, $from);
        if ($final === null || $final === $from) {
            throw new HttpException(422, 'validation_failed', 'Редирект создаёт цикл', ['to_path' => 'Новый адрес в итоге ведёт обратно на старый']);
        }
        $existing = $this->pdo->prepare('SELECT id FROM redirects WHERE from_path = :from');
        $existing->execute(['from' => $from]);
        $sameFrom = $existing->fetchColumn();
        if ($sameFrom !== false && (int) $sameFrom !== $id) {
            if ($automatic) $id = (int) $sameFrom;
            else throw new HttpException(422, 'validation_failed', 'Для этого адреса уже есть редирект', ['from_path' => 'Такой старый адрес уже есть в таблице']);
        }
        if ($id === null) {
            $statement = $this->pdo->prepare(
                'INSERT INTO redirects (from_path, to_path, status_code, is_automatic, created_at, updated_at)
                 VALUES (:from, :to, :code, :automatic, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
            );
            $statement->execute(['from' => $from, 'to' => $final, 'code' => $code, 'automatic' => $automatic ? 1 : 0]);
        } else {
            $statement = $this->pdo->prepare('UPDATE redirects SET from_path = :from, to_path = :to, status_code = :code, updated_at = UTC_TIMESTAMP() WHERE id = :id');
            $statement->execute(['from' => $from, 'to' => $final, 'code' => $code, 'id' => $id]);
        }
        $collapse = $this->pdo->prepare('UPDATE redirects SET to_path = :final, updated_at = UTC_TIMESTAMP() WHERE to_path = :from');
        $collapse->execute(['final' => $final, 'from' => $from]);
        // A live page must never redirect away from itself.
        if (str_starts_with($final, '/')) {
            $live = $this->pdo->prepare('DELETE FROM redirects WHERE from_path = :final');
            $live->execute(['final' => $final]);
        }
    }

    /** After a slug change: the old address answers 301 with the new one. */
    public function slugChanged(string $oldPath, string $newPath): void
    {
        if ($oldPath === $newPath) return;
        // The new address is a live page again (e.g. a slug changed back): drop its old rule first.
        $live = $this->pdo->prepare('DELETE FROM redirects WHERE from_path = :path');
        $live->execute(['path' => $newPath]);
        $this->saveRedirect(null, $oldPath, $newPath, 301, true);
    }

    public function deleteRedirect(int $id): void
    {
        $statement = $this->pdo->prepare('DELETE FROM redirects WHERE id = :id');
        $statement->execute(['id' => $id]);
    }

    /** Follows existing rules from $to; null when they lead back to $from (a loop). */
    private function resolve(string $to, string $from): ?string
    {
        $seen = [$from => true];
        $current = $to;
        for ($step = 0; $step < 20 && str_starts_with($current, '/'); $step++) {
            if (isset($seen[$current])) return null;
            $seen[$current] = true;
            $next = $this->pdo->prepare('SELECT to_path FROM redirects WHERE from_path = :path');
            $next->execute(['path' => $current]);
            $target = $next->fetchColumn();
            if ($target === false) return $current;
            $current = (string) $target;
        }
        return isset($seen[$current]) ? null : $current;
    }
}
