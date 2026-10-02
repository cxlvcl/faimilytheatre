<?php
declare(strict_types=1);

namespace Theatre\Core;

final class Request
{
    private ?array $body = null;
    private ?array $headers = null;

    public function __construct(private readonly string $apiPrefix = '/api')
    {
    }

    public function method(): string
    {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        if ($method === 'POST' && isset($_POST['_method']) && is_string($_POST['_method'])) {
            $override = strtoupper((string) $_POST['_method']);
            if (in_array($override, ['PUT', 'PATCH', 'DELETE'], true)) {
                return $override;
            }
        }
        return $method;
    }

    public function path(): string
    {
        $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = rawurldecode((string) (parse_url($uri, PHP_URL_PATH) ?: '/'));
        if ($this->apiPrefix !== '' && str_starts_with($path, $this->apiPrefix)) {
            $path = substr($path, strlen($this->apiPrefix)) ?: '/';
        }
        return '/' . ltrim(rtrim($path, '/'), '/');
    }

    public function body(): array
    {
        if ($this->body !== null) {
            return $this->body;
        }
        $contentType = strtolower((string) ($this->header('content-type') ?? ''));
        if (str_contains($contentType, 'application/json')) {
            $raw = file_get_contents('php://input', false, null, 0, 131073) ?: '';
            if (strlen($raw) > 131072) throw new HttpException(400, 'body_too_large', 'Слишком большой запрос');
            try {
                $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                throw new HttpException(400, 'invalid_json', 'Некорректный JSON');
            }
            if (!is_array($decoded)) {
                throw new HttpException(400, 'invalid_json', 'Некорректный JSON');
            }
            return $this->body = $decoded;
        }
        return $this->body = $_POST;
    }

    public function files(): array
    {
        return $_FILES;
    }

    public function header(string $name): ?string
    {
        if ($this->headers === null) {
            $headers = function_exists('getallheaders') ? getallheaders() : [];
            foreach ($_SERVER as $key => $value) {
                if (str_starts_with($key, 'HTTP_')) {
                    $headers[str_replace('_', '-', substr($key, 5))] = $value;
                }
            }
            $this->headers = array_change_key_case($headers, CASE_LOWER);
            // Apache CGI/FastCGI drops Authorization; .htaccess passes it back as an
            // environment variable, which internal rewrites prefix with REDIRECT_.
            foreach (['REDIRECT_HTTP_AUTHORIZATION', 'REDIRECT_REDIRECT_HTTP_AUTHORIZATION'] as $key) {
                if (!isset($this->headers['authorization']) && is_string($_SERVER[$key] ?? null) && $_SERVER[$key] !== '') {
                    $this->headers['authorization'] = $_SERVER[$key];
                }
            }
        }
        $value = $this->headers[strtolower($name)] ?? null;
        return is_string($value) ? $value : null;
    }

    public function bearerToken(): ?string
    {
        $authorization = $this->header('authorization');
        if ($authorization !== null && preg_match('/^Bearer\s+(.+)$/i', $authorization, $matches) === 1) {
            return trim($matches[1]);
        }
        return null;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $_GET[$key] ?? $default;
    }

    public function clientIp(): string
    {
        return (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    }
}
