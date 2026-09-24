<?php
declare(strict_types=1);

namespace Theatre\Core;

final class Logger
{
    public function __construct(
        private readonly string $directory,
        private readonly string $requestId,
    ) {
    }

    public function error(string $message, array $context = []): void
    {
        $this->write('ERROR', $message, $context, 'error');
    }

    public function warning(string $message, array $context = []): void
    {
        $this->write('WARNING', $message, $context, 'app');
    }

    public function info(string $message, array $context = []): void
    {
        $this->write('INFO', $message, $context, 'app');
    }

    private function write(string $level, string $message, array $context, string $stream): void
    {
        if (!is_dir($this->directory) && !mkdir($concurrentDirectory = $this->directory, 0750, true) && !is_dir($concurrentDirectory)) {
            return;
        }
        $base = $this->directory . '/' . $stream . '-' . gmdate('Y-m-d') . '.log';
        $file = $base;
        if (is_file($base) && filesize($base) >= 10 * 1024 * 1024) {
            for ($suffix = 1; $suffix <= 20; $suffix++) {
                $candidate = $base . '.' . $suffix;
                if (!is_file($candidate) || filesize($candidate) < 10 * 1024 * 1024) {
                    $file = $candidate;
                    break;
                }
            }
        }
        $safeContext = array_filter($context, static fn (string $key): bool => !in_array(
            strtolower($key),
            ['password', 'password_hash', 'token', 'authorization', 'db_password', 'phone'],
            true
        ), ARRAY_FILTER_USE_KEY);
        $line = json_encode([
            'time' => gmdate('c'),
            'level' => $level,
            'request_id' => $this->requestId,
            'message' => $message,
            'context' => $safeContext,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        @file_put_contents($file, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
    }
}

