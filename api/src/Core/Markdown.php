<?php
declare(strict_types=1);

namespace Theatre\Core;

final class Markdown
{
    public static function validate(string $value, string $field, array &$errors): void
    {
        $forbidden = [
            '/<[^>]*>/',
            '/(^|\n)\s{0,3}#{1,6}\s/u',
            '/(^|\n)\s*[-+*]\s+/u',
            '/(^|\n)\s*\d+\.\s+/u',
            '/!?\[[^\]]*\]\([^)]*\)/u',
            '/```|`[^`]+`/u',
            '/(^|\n)\s*>/u',
            '/\|.*\|/u',
            '/(^|\n)(?: {4}|\t)/u',
            '/(^|\n)\s*(?:[-*_]\s*){3,}(?:\n|$)/u',
            '/\[[^\]]*\]\s*[:\[]/u',
        ];
        foreach ($forbidden as $pattern) {
            if (preg_match($pattern, $value) === 1) {
                $errors[$field] = 'Разрешены только абзацы, жирный и курсивный текст';
                return;
            }
        }
    }
}
