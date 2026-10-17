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

    /** Articles: subheadings, lists, quotes, links, tables and uploaded photos; never HTML or code. */
    public static function validateArticle(string $value, string $field, array &$errors): void
    {
        $patterns = ['/<[^>]*>/', '/```|`[^`]+`/u', '/(^|\n)(?: {4}|\t)\S/u', '/(^|\n)\s{0,3}(?:#|#{4,6})\s/u', '/\[[^\]]*\]\s*[:\[]/u'];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $value) === 1) {
                $errors[$field] = 'HTML и код не допускаются: используйте кнопки форматирования';
                return;
            }
        }
        // Links only to http(s) or site paths; photos only from uploads or https.
        if (preg_match_all('/(!?)\[[^\]]*\]\(([^)]*)\)/u', $value, $links, PREG_SET_ORDER) > 0) {
            foreach ($links as $link) {
                $ok = $link[1] === '!' ? preg_match('#^(?:/uploads/|https://)[^\s<>"]+$#', $link[2]) === 1 : preg_match('#^(?:https?://|/)[^\s<>"]*$#', $link[2]) === 1;
                if (!$ok) {
                    $errors[$field] = 'Некорректная ссылка: ' . mb_substr($link[2], 0, 60);
                    return;
                }
            }
        }
    }
}
