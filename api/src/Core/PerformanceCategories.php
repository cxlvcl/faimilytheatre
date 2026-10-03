<?php
declare(strict_types=1);

namespace Theatre\Core;

use PDO;

/** Repertoire sections («Малышам», «Школьникам», «Взрослым», «Новогодние»); a performance may be in several. */
final class PerformanceCategories
{
    public const ALL = ['kids', 'school', 'adults', 'new_year'];

    /** @return array<int, list<string>> performance id => categories in the canonical order */
    public static function load(PDO $pdo, ?int $performanceId = null): array
    {
        $sql = 'SELECT performance_id, category FROM performance_categories';
        $statement = $pdo->prepare($performanceId === null ? $sql : $sql . ' WHERE performance_id = :id');
        $statement->execute($performanceId === null ? [] : ['id' => $performanceId]);
        $result = [];
        foreach ($statement->fetchAll() as $row) {
            $result[(int) $row['performance_id']][] = (string) $row['category'];
        }
        foreach ($result as $id => $categories) {
            $result[$id] = array_values(array_intersect(self::ALL, $categories));
        }
        return $result;
    }

    /**
     * Reads `categories` (array or comma-separated string). Empty values are ignored, so a form can send
     * an empty field to clear every section. Returns null when the field is absent: sections stay as they are.
     */
    public static function parse(array $input, array &$errors): ?array
    {
        if (!array_key_exists('categories', $input)) {
            return null;
        }
        $raw = $input['categories'];
        $values = is_array($raw) ? $raw : explode(',', (string) $raw);
        $categories = [];
        foreach ($values as $value) {
            $value = is_string($value) ? trim($value) : '';
            if ($value === '') {
                continue;
            }
            if (!in_array($value, self::ALL, true)) {
                $errors['categories'] = 'Неизвестный раздел репертуара';
                return [];
            }
            $categories[] = $value;
        }
        return array_values(array_intersect(self::ALL, $categories));
    }

    public static function save(PDO $pdo, int $performanceId, array $categories): void
    {
        $pdo->prepare('DELETE FROM performance_categories WHERE performance_id = :id')->execute(['id' => $performanceId]);
        $insert = $pdo->prepare('INSERT INTO performance_categories (performance_id, category) VALUES (:id, :category)');
        foreach ($categories as $category) {
            $insert->execute(['id' => $performanceId, 'category' => $category]);
        }
    }
}
