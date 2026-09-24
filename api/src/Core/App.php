<?php
declare(strict_types=1);

namespace Theatre\Core;

final class App
{
    private ?Database $database = null;
    private ?RateLimiter $rateLimiter = null;
    private ?Auth $auth = null;
    private ?Upload $upload = null;

    public function __construct(
        public readonly array $config,
        public readonly Logger $logger,
        public readonly string $requestId,
    ) {
    }

    public function db(): Database
    {
        return $this->database ??= new Database($this->config['db']);
    }

    public function rateLimiter(): RateLimiter
    {
        return $this->rateLimiter ??= new RateLimiter(
            $this->config['paths']['runtime'] . '/rate-limit',
            (string) $this->config['secrets']['app']
        );
    }

    public function auth(): Auth
    {
        return $this->auth ??= new Auth($this->db(), (int) $this->config['admin_token_days']);
    }

    public function upload(): Upload
    {
        return $this->upload ??= new Upload($this->config['uploads']);
    }
}

