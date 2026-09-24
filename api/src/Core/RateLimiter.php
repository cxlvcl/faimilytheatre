<?php
declare(strict_types=1);

namespace Theatre\Core;

final class RateLimiter
{
    public function __construct(
        private readonly string $directory,
        private readonly string $secret,
    ) {
        if ($this->secret === '') {
            throw new \RuntimeException('APP_SECRET is required.');
        }
    }

    public function ipKey(string $ip): string
    {
        return hash_hmac('sha256', $ip, $this->secret);
    }

    public function enforce(string $bucket, string $key, int $limit, int $windowSeconds): void
    {
        $state = $this->mutate($bucket, $key, static function (array $state, int $now) use ($limit, $windowSeconds): array {
            if (($state['blocked_until'] ?? 0) > $now) { $state['limited'] = true; return $state; }
            if (($state['window_start'] ?? 0) <= $now - $windowSeconds) {
                $state = ['window_start' => $now, 'count' => 0, 'blocked_until' => 0];
            }
            if (($state['blocked_until'] ?? 0) > $now || ($state['count'] ?? 0) >= $limit) {
                $state['blocked_until'] = (int) $state['window_start'] + $windowSeconds;
                $state['limited'] = true;
                return $state;
            }
            $state['count'] = (int) ($state['count'] ?? 0) + 1;
            $state['limited'] = false;
            return $state;
        });
        if (($state['limited'] ?? false) === true) {
            throw new HttpException(429, 'rate_limited', 'Слишком много попыток. Попробуйте немного позже.');
        }
    }

    public function assertNotBlocked(string $bucket, string $key): void
    {
        $state = $this->read($bucket, $key);
        if ((int) ($state['blocked_until'] ?? 0) > time()) {
            throw new HttpException(429, 'rate_limited', 'Слишком много попыток. Попробуйте немного позже.');
        }
    }

    public function failedAttempt(string $bucket, string $key, int $limit, int $windowSeconds, int $blockSeconds): void
    {
        $state = $this->mutate($bucket, $key, static function (array $state, int $now) use ($limit, $windowSeconds, $blockSeconds): array {
            if (($state['window_start'] ?? 0) <= $now - $windowSeconds) {
                $state = ['window_start' => $now, 'count' => 0, 'blocked_until' => 0];
            }
            $state['count'] = (int) ($state['count'] ?? 0) + 1;
            if ($state['count'] >= $limit) {
                $state['blocked_until'] = $now + $blockSeconds;
            }
            return $state;
        });
        if ((int) ($state['blocked_until'] ?? 0) > time()) {
            throw new HttpException(429, 'rate_limited', 'Слишком много попыток. Попробуйте немного позже.');
        }
    }

    public function clear(string $bucket, string $key): void
    {
        $file = $this->file($bucket, $key);
        if (is_file($file)) {
            @unlink($file);
        }
    }

    private function read(string $bucket, string $key): array
    {
        $file = $this->file($bucket, $key);
        if (!is_file($file)) {
            return [];
        }
        $decoded = json_decode((string) @file_get_contents($file), true);
        return is_array($decoded) ? $decoded : [];
    }

    private function mutate(string $bucket, string $key, callable $callback): array
    {
        if (!is_dir($this->directory) && !mkdir($concurrentDirectory = $this->directory, 0750, true) && !is_dir($concurrentDirectory)) {
            throw new \RuntimeException('Unable to create rate limit directory.');
        }
        $file = $this->file($bucket, $key);
        $handle = fopen($file, 'c+');
        if ($handle === false) {
            throw new \RuntimeException('Unable to open rate limit state.');
        }
        try {
            if (!flock($handle, LOCK_EX)) {
                throw new \RuntimeException('Unable to lock rate limit state.');
            }
            $raw = stream_get_contents($handle);
            $decoded = json_decode($raw ?: '{}', true);
            $state = $callback(is_array($decoded) ? $decoded : [], time());
            rewind($handle);
            ftruncate($handle, 0);
            fwrite($handle, json_encode($state, JSON_THROW_ON_ERROR));
            fflush($handle);
            flock($handle, LOCK_UN);
            return $state;
        } finally {
            fclose($handle);
        }
    }

    private function file(string $bucket, string $key): string
    {
        $safeBucket = preg_replace('/[^a-z0-9_-]/i', '-', $bucket) ?: 'default';
        return $this->directory . '/' . $safeBucket . '-' . hash('sha256', $key) . '.json';
    }
}
