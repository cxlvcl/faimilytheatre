<?php
declare(strict_types=1);

namespace Theatre\Core;

final class Validator
{
    public static function text(array $input, string $field, int $min, int $max, array &$errors): string
    {
        $raw = $input[$field] ?? '';
        if (!is_string($raw)) { $errors[$field] = 'Введите текст'; return ''; }
        $value = trim($raw);
        $length = mb_strlen($value);
        if ($length < $min || $length > $max) {
            $errors[$field] = sprintf('От %d до %d символов', $min, $max);
        }
        return $value;
    }

    public static function integer(array $input, string $field, int $min, int $max, array &$errors): int
    {
        $value = filter_var($input[$field] ?? null, FILTER_VALIDATE_INT);
        if ($value === false || $value < $min || $value > $max) {
            $errors[$field] = sprintf('Значение от %d до %d', $min, $max);
            return $min;
        }
        return (int) $value;
    }

    public static function boolean(array $input, string $field): bool
    {
        $value = $input[$field] ?? false;
        return $value === true || $value === 1 || $value === '1' || $value === 'true' || $value === 'on';
    }

    public static function url(array $input, string $field, array &$errors): string
    {
        $value = self::text($input, $field, 1, 2048, $errors);
        if (strlen($value) > 2048 || filter_var($value, FILTER_VALIDATE_URL) === false) {
            $errors[$field] = 'Введите корректный адрес http/https';
            return $value;
        }
        $scheme = strtolower((string) parse_url($value, PHP_URL_SCHEME));
        if (!in_array($scheme, ['http', 'https'], true)) {
            $errors[$field] = 'Разрешены только http/https';
        }
        return $value;
    }

    public static function date(array $input, string $field, array &$errors): string
    {
        $value = self::text($input, $field, 10, 10, $errors);
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value, new \DateTimeZone('Europe/Moscow'));
        if ($date === false || $date->format('Y-m-d') !== $value) {
            $errors[$field] = 'Введите дату в формате YYYY-MM-DD';
        }
        return $value;
    }

    public static function time(array $input, string $field, array &$errors): ?string
    {
        $raw = $input[$field] ?? null;
        if ($raw === null || $raw === '') return null;
        if (!is_string($raw) || preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D', trim($raw)) !== 1) {
            $errors[$field] = 'Введите время в формате ЧЧ:ММ (от 00:00 до 23:59)';
            return null;
        }
        return trim($raw);
    }

    public static function throwIfErrors(array $errors): void
    {
        if ($errors !== []) {
            throw new HttpException(422, 'validation_failed', 'Проверьте заполненные поля', $errors);
        }
    }
}
