<?php
declare(strict_types=1);

namespace Theatre\Core;

final class Markdown
{
    private const FORBIDDEN = [
        '/<[^>]*>/',
        '/!?\[[^\]]*\]\([^)]*\)/u',
        '/```|`[^`]+`/u',
        '/(^|\n)\s*>/u',
        '/\|.*\|/u',
        '/(^|\n)(?: {4}|\t)/u',
        '/(^|\n)\s*(?:[-*_]\s*){3,}(?:\n|$)/u',
        '/\[[^\]]*\]\s*[:\[]/u',
        '/(^|\n)\s*\d+\.\s+/u',
    ];

    public static function validate(string $value, string $field, array &$errors): void
    {
        $patterns = [...self::FORBIDDEN, '/(^|\n)\s{0,3}#{1,6}\s/u', '/(^|\n)\s*[-+*]\s+/u'];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $value) === 1) {
                $errors[$field] = 'Разрешены только абзацы, жирный и курсивный текст';
                return;
            }
        }
    }

    /** Articles additionally allow "## " / "### " subheadings and "- " bullet lists. */
    public static function validateArticle(string $value, string $field, array &$errors): void
    {
        $patterns = [...self::FORBIDDEN, '/(^|\n)\s{0,3}(?:#|#{4,6})\s/u', '/(^|\n)\s*[+*]\s+/u', '/(^|\n)[ \t]+-\s+/u'];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $value) === 1) {
                $errors[$field] = 'Разрешены абзацы, подзаголовки ## и ###, списки «- », жирный и курсив';
                return;
            }
        }
    }
}
