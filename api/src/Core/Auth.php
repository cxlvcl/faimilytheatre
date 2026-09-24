<?php
declare(strict_types=1);

namespace Theatre\Core;

use DateTimeImmutable;
use DateTimeZone;
use PDO;

final class Auth
{
    public function __construct(
        private readonly Database $database,
        private readonly int $tokenDays,
    ) {
    }

    public function login(string $login, string $password): ?array
    {
        $statement = $this->database->pdo()->prepare(
            'SELECT id, login, password_hash FROM `admin` WHERE login = :login LIMIT 1'
        );
        $statement->execute(['login' => $login]);
        $admin = $statement->fetch();
        if (!is_array($admin) || !password_verify($password, (string) $admin['password_hash'])) {
            return null;
        }
        if (password_needs_rehash((string) $admin['password_hash'], PASSWORD_DEFAULT)) {
            $update = $this->database->pdo()->prepare(
                'UPDATE `admin` SET password_hash = :hash, updated_at = UTC_TIMESTAMP() WHERE id = :id'
            );
            $update->execute(['hash' => password_hash($password, PASSWORD_DEFAULT), 'id' => $admin['id']]);
        }
        $rawToken = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
        $tokenHash = hash('sha256', $rawToken);
        $expires = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
            ->modify('+' . $this->tokenDays . ' days')
            ->format('Y-m-d H:i:s');
        $insert = $this->database->pdo()->prepare(
            'INSERT INTO admin_tokens (admin_id, token_hash, expires_at, created_at, last_used_at)
             VALUES (:admin_id, :token_hash, :expires_at, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
        );
        $insert->execute([
            'admin_id' => $admin['id'],
            'token_hash' => $tokenHash,
            'expires_at' => $expires,
        ]);
        return [
            'token' => $rawToken,
            'expires_at' => str_replace(' ', 'T', $expires) . 'Z',
            'admin' => ['id' => (int) $admin['id'], 'login' => (string) $admin['login']],
        ];
    }

    public function requireAdmin(?string $token): array
    {
        if ($token === null || strlen($token) < 32) {
            throw new HttpException(401, 'unauthorized', 'Требуется авторизация');
        }
        $hash = hash('sha256', $token);
        $statement = $this->database->pdo()->prepare(
            'SELECT a.id, a.login, t.id AS token_id, t.last_used_at
             FROM admin_tokens t
             INNER JOIN `admin` a ON a.id = t.admin_id
             WHERE t.token_hash = :hash AND t.expires_at > UTC_TIMESTAMP()
             LIMIT 1'
        );
        $statement->execute(['hash' => $hash]);
        $admin = $statement->fetch();
        if (!is_array($admin)) {
            throw new HttpException(401, 'unauthorized', 'Сессия завершена');
        }
        if (strtotime((string) $admin['last_used_at']) < time() - 300) {
            $update = $this->database->pdo()->prepare(
                'UPDATE admin_tokens SET last_used_at = UTC_TIMESTAMP() WHERE id = :id'
            );
            $update->execute(['id' => $admin['token_id']]);
        }
        return ['id' => (int) $admin['id'], 'login' => (string) $admin['login']];
    }

    public function logout(?string $token): void
    {
        if ($token === null) {
            return;
        }
        $statement = $this->database->pdo()->prepare('DELETE FROM admin_tokens WHERE token_hash = :hash');
        $statement->execute(['hash' => hash('sha256', $token)]);
    }
}

