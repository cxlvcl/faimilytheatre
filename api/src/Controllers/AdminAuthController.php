<?php
declare(strict_types=1);

namespace Theatre\Controllers;

use Theatre\Core\App;
use Theatre\Core\HttpException;
use Theatre\Core\Request;

final class AdminAuthController
{
    public function __construct(private readonly App $app)
    {
    }

    public function login(Request $request): array
    {
        $key = $this->app->rateLimiter()->ipKey($request->clientIp());
        $this->app->rateLimiter()->assertNotBlocked('admin-login', $key);
        $input = $request->body();
        $login = is_string($input['login'] ?? null) ? trim($input['login']) : '';
        $password = is_string($input['password'] ?? null) ? $input['password'] : '';
        if (strlen($login) > 150 || strlen($password) > 1024) throw new HttpException(422, 'validation_failed', 'Проверьте данные входа');
        $result = $this->app->auth()->login($login, $password);
        if ($result === null) {
            try {
                $this->app->rateLimiter()->failedAttempt('admin-login', $key, 5, 900, 900);
            } catch (HttpException $error) {
                throw $error;
            }
            throw new HttpException(401, 'invalid_credentials', 'Неверный логин или пароль');
        }
        $this->app->rateLimiter()->clear('admin-login', $key);
        return $result;
    }

    public function me(Request $request): array
    {
        $admin = $this->app->auth()->requireAdmin($request->bearerToken());
        $this->app->rateLimiter()->enforce('admin-api', 'admin-' . $admin['id'], 120, 60);
        return ['admin' => $admin];
    }

    public function logout(Request $request): array
    {
        $this->app->auth()->requireAdmin($request->bearerToken());
        $this->app->auth()->logout($request->bearerToken());
        return ['logged_out' => true];
    }
}
