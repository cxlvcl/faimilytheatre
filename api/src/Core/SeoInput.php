<?php
declare(strict_types=1);

namespace Theatre\Core;

use PDO;

/**
 * Validates the SEO-related form fields. Every group is optional: an older admin build that
 * does not send a group leaves the stored values untouched (null result).
 */
final class SeoInput
{
    /** Title/Description/H1/canonical/noindex/OG texts; the OG image file is handled by the caller. */
    public static function meta(array $input, array &$errors): ?array
    {
        if (!array_key_exists('seo_title', $input)) return null;
        $values = [
            'title' => self::plain($input, 'seo_title', 200, $errors),
            'description' => self::plain($input, 'seo_description', 400, $errors),
            'h1' => self::plain($input, 'seo_h1', 200, $errors),
            'canonical' => self::canonical($input, $errors),
            'noindex' => Validator::boolean($input, 'seo_noindex'),
            'og_title' => self::plain($input, 'seo_og_title', 200, $errors),
            'og_description' => self::plain($input, 'seo_og_description', 400, $errors),
            'og_image_remove' => Validator::boolean($input, 'seo_og_image_remove'),
        ];
        return $values;
    }

    /** @return list<array{question:string, answer:string}>|null */
    public static function faq(array $input, array &$errors): ?array
    {
        if (!array_key_exists('faq_present', $input)) return null;
        $pairs = [];
        $rows = $input['faq'] ?? [];
        if (!is_array($rows) || count($rows) > 200) {
            $errors['faq'] = 'Некорректный список вопросов';
            return [];
        }
        foreach (array_values($rows) as $index => $row) {
            $question = is_array($row) ? trim((string) ($row['question'] ?? '')) : '';
            $answer = is_array($row) ? trim(str_replace("\r\n", "\n", (string) ($row['answer'] ?? ''))) : '';
            if ($question === '' && $answer === '') continue;
            $number = $index + 1;
            if ($question === '' || mb_strlen($question) > 150) $errors['faq'] = "Вопрос {$number}: от 1 до 150 знаков";
            elseif ($question !== strip_tags($question)) $errors['faq'] = "Вопрос {$number}: только обычный текст";
            elseif ($answer === '' || mb_strlen($answer) > 5000) $errors['faq'] = "Ответ {$number}: от 1 до 5000 знаков";
            elseif ($answer !== strip_tags($answer)) $errors['faq'] = "Ответ {$number}: HTML-теги не допускаются";
            else $pairs[] = ['question' => $question, 'answer' => $answer];
        }
        return $pairs;
    }

    /** @return list<int>|null ids from the FAQ page attached with a checkbox */
    public static function sharedFaq(array $input, PDO $pdo, array &$errors): ?array
    {
        if (!array_key_exists('shared_faq_present', $input)) return null;
        return self::existingIds($input['shared_faq'] ?? [], $pdo, 'faq', 'shared_faq', $errors);
    }

    /** @return list<int>|null */
    public static function linkedIds(array $input, string $field, string $table, PDO $pdo, array &$errors): ?array
    {
        if (!array_key_exists($field . '_present', $input)) return null;
        return self::existingIds($input[$field] ?? [], $pdo, $table, $field, $errors);
    }

    /** @return array<string, string>|null field => alt, only for the fields present in the form */
    public static function alts(array $input, array $fields, array &$errors): ?array
    {
        $alts = [];
        foreach ($fields as $field) {
            $key = $field . '_alt';
            if (array_key_exists($key, $input)) $alts[$field] = self::plain($input, $key, 250, $errors);
        }
        return $alts === [] ? null : $alts;
    }

    /** New slug, '' when the form keeps the current one, null when the field is absent. */
    public static function slug(array $input, array &$errors): ?string
    {
        if (!array_key_exists('slug', $input)) return null;
        $slug = strtolower(trim((string) $input['slug']));
        if ($slug !== '' && (strlen($slug) > 180 || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) !== 1)) {
            $errors['slug'] = 'Только латиница, цифры и дефис, до 180 знаков';
        }
        return $slug;
    }

    public static function performanceDetails(array $input, array &$errors): ?array
    {
        if (!array_key_exists('details_present', $input)) return null;
        $names = array_values(array_filter(array_map('trim', explode("\n", str_replace("\r\n", "\n", (string) ($input['alternate_names'] ?? '')))), 'strlen'));
        if (count($names) > 10 || array_filter($names, static fn ($name) => mb_strlen($name) > 150 || $name !== strip_tags($name)) !== []) {
            $errors['alternate_names'] = 'До 10 названий, каждое до 150 знаков';
        }
        $age = trim((string) ($input['age_rating'] ?? ''));
        if ($age !== '' && !in_array($age, SeoStore::AGE_RATINGS, true)) $errors['age_rating'] = 'Выберите маркировку из списка';
        $min = self::optionalInt($input, 'duration_min', 1, 600, $errors);
        $max = self::optionalInt($input, 'duration_max', 1, 600, $errors);
        if ($min !== null && $max !== null && $min > $max) $errors['duration_max'] = '«До» не может быть меньше «от»';
        return [
            'genre' => self::plain($input, 'genre', 150, $errors),
            'work_author' => self::plain($input, 'work_author', 150, $errors),
            'work_title' => self::plain($input, 'work_title', 200, $errors),
            'alternate_names' => $names,
            'age_rating' => $age === '' ? null : $age,
            'duration_min' => $min,
            'duration_max' => $max,
            'has_intermission' => Validator::boolean($input, 'has_intermission'),
            'price_from' => self::optionalInt($input, 'price_from', 0, 1000000, $errors),
        ];
    }

    /** Settings page; robots.txt and the head code are free text with size limits. */
    public static function settings(array $input, array &$errors): array
    {
        $values = [];
        foreach (['metrika_id', 'vk_pixel_id'] as $name) {
            $value = trim((string) ($input[$name] ?? ''));
            if ($value !== '' && preg_match('/^\d{1,20}$/', $value) !== 1) $errors[$name] = 'Только цифры номера, без кода счётчика';
            $values[$name] = $value;
        }
        $values['head_code'] = trim(str_replace("\r\n", "\n", (string) ($input['head_code'] ?? '')));
        if (strlen($values['head_code']) > 20000) $errors['head_code'] = 'Не больше 20 000 знаков';
        foreach (['verification_yandex', 'verification_google'] as $name) {
            $value = self::verificationCode((string) ($input[$name] ?? ''));
            if ($value !== '' && preg_match('/^[A-Za-z0-9_\-:.=]{4,200}$/', $value) !== 1) $errors[$name] = 'Вставьте код или meta-тег целиком';
            $values[$name] = $value;
        }
        $vk = trim((string) ($input['verification_vk'] ?? ''));
        if ($vk !== '' && self::metaTag($vk) === null) $errors['verification_vk'] = 'Вставьте meta-тег из кабинета VK целиком: <meta name="…" content="…">';
        $values['verification_vk'] = $vk;
        $values['robots_txt'] = trim(str_replace("\r\n", "\n", (string) ($input['robots_txt'] ?? '')));
        if (strlen($values['robots_txt']) > 10000) $errors['robots_txt'] = 'Не больше 10 000 знаков';
        elseif (preg_match('/^\s*sitemap\s*:/mi', $values['robots_txt']) === 1) $errors['robots_txt'] = 'Строку Sitemap: сайт добавляет сам — удалите её';
        foreach (['org_name' => 150, 'org_description' => 300, 'org_city' => 100, 'org_email' => 150] as $name => $max) {
            $values[$name] = self::plain($input, $name, $max, $errors);
        }
        if ($values['org_name'] === '') $errors['org_name'] = 'Укажите название';
        if ($values['org_email'] !== '' && filter_var($values['org_email'], FILTER_VALIDATE_EMAIL) === false) $errors['org_email'] = 'Некорректный email';
        $phones = array_values(array_filter(array_map('trim', explode("\n", str_replace("\r\n", "\n", (string) ($input['org_phones'] ?? '')))), 'strlen'));
        if (count($phones) > 5 || array_filter($phones, static fn ($phone) => preg_match('/^[+\d][\d\s()\-]{4,24}$/', $phone) !== 1) !== []) $errors['org_phones'] = 'По одному телефону в строке, до 5';
        $values['org_phones'] = implode("\n", $phones);
        foreach (['org_vk', 'org_telegram', 'org_yandex_maps'] as $name) {
            $value = trim((string) ($input[$name] ?? ''));
            if ($value !== '' && (strlen($value) > 500 || preg_match('#^https://[^\s<>"]+$#', $value) !== 1)) $errors[$name] = 'Ссылка должна начинаться с https://';
            $values[$name] = $value;
        }
        return $values;
    }

    /** «abc123» or <meta name="…" content="abc123"> → abc123 */
    public static function verificationCode(string $value): string
    {
        $value = trim($value);
        if (preg_match('/content\s*=\s*["\']([^"\']+)["\']/i', $value, $match) === 1) return trim($match[1]);
        return $value;
    }

    /** @return array{name:string, content:string}|null a single safe <meta name content> tag */
    public static function metaTag(string $value): ?array
    {
        if (preg_match('/^\s*<meta\s+[^<>]*>\s*$/i', $value) !== 1) return null;
        if (preg_match('/\bname\s*=\s*["\']([a-z0-9_.:\-]{1,64})["\']/i', $value, $name) !== 1) return null;
        if (preg_match('/\bcontent\s*=\s*["\']([^"\'<>]{1,300})["\']/i', $value, $content) !== 1) return null;
        return ['name' => $name[1], 'content' => $content[1]];
    }

    /** Redirect rule paths: «/old/page» (or a full URL of this site for the old address). */
    public static function redirectPath(string $value, string $field, array &$errors, bool $allowExternal): string
    {
        $value = trim($value);
        if (preg_match('#^https?://#i', $value) === 1) {
            if ($allowExternal) {
                if (strlen($value) > 500 || filter_var($value, FILTER_VALIDATE_URL) === false) $errors[$field] = 'Некорректная ссылка';
                return $value;
            }
            $value = (string) (parse_url($value, PHP_URL_PATH) ?: '/');
        }
        if ($value === '' || $value[0] !== '/' || str_starts_with($value, '//') || strlen($value) > 255 || preg_match('/[\s<>"\']/', $value) === 1) {
            $errors[$field] = 'Адрес должен начинаться с /';
            return $value;
        }
        return Seo::path($value);
    }

    private static function plain(array $input, string $field, int $max, array &$errors): string
    {
        $value = trim(preg_replace('/\s+/u', ' ', (string) ($input[$field] ?? '')) ?? '');
        if (mb_strlen($value) > $max) $errors[$field] = "Не больше {$max} знаков";
        elseif ($value !== strip_tags($value) || preg_match('/[<>]/', $value) === 1) $errors[$field] = 'Только обычный текст, без HTML';
        return $value;
    }

    private static function canonical(array $input, array &$errors): string
    {
        $value = trim((string) ($input['seo_canonical'] ?? ''));
        if ($value === '') return '';
        if (strlen($value) > 500 || preg_match('/[\s<>"\']/', $value) === 1) {
            $errors['seo_canonical'] = 'Некорректный адрес';
            return $value;
        }
        if (str_starts_with($value, '/') && !str_starts_with($value, '//')) return $value;
        if (filter_var($value, FILTER_VALIDATE_URL) !== false && preg_match('#^https?://#i', $value) === 1) return $value;
        $errors['seo_canonical'] = 'Укажите путь вида /afisha или полный адрес https://…';
        return $value;
    }

    private static function optionalInt(array $input, string $field, int $min, int $max, array &$errors): ?int
    {
        $value = trim((string) ($input[$field] ?? ''));
        if ($value === '') return null;
        $number = filter_var($value, FILTER_VALIDATE_INT);
        if ($number === false || $number < $min || $number > $max) {
            $errors[$field] = "Число от {$min} до {$max}";
            return null;
        }
        return $number;
    }

    /** @return list<int> */
    private static function existingIds(mixed $value, PDO $pdo, string $table, string $field, array &$errors): array
    {
        if (!in_array($table, ['faq', 'articles', 'performances'], true)) throw new \RuntimeException('Unsafe table.');
        $ids = array_values(array_unique(array_filter(array_map('intval', is_array($value) ? $value : []), static fn ($id) => $id > 0)));
        if ($ids === []) return [];
        $statement = $pdo->prepare("SELECT id FROM {$table} WHERE id IN (" . implode(',', array_fill(0, count($ids), '?')) . ')');
        $statement->execute($ids);
        $found = array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
        if (count($found) !== count($ids)) $errors[$field] = 'Список устарел: обновите форму';
        return $found;
    }
}
