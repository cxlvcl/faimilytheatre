<?php
declare(strict_types=1);

namespace Theatre\Core;

final class Response
{
    public static function success(mixed $data = [], int $status = 200, ?string $requestId = null): never
    {
        self::send(['success' => true, 'data' => $data], $status, $requestId);
    }

    public static function error(
        string $code,
        string $message,
        int $status,
        array $fields = [],
        ?string $requestId = null,
        array $extra = [],
    ): never {
        $error = ['code' => $code, 'message' => $message];
        if ($fields !== []) {
            $error['fields'] = $fields;
        }
        self::send(array_merge(['success' => false, 'error' => $error], $extra), $status, $requestId);
    }

    private static function send(array $payload, int $status, ?string $requestId): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        if ($requestId !== null) {
            header('X-Request-Id: ' . $requestId);
        }
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        exit;
    }
}

