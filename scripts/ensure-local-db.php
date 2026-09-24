<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$root = dirname(__DIR__);
$configPath = $root . '/private/config.php';
if (!is_file($configPath)) { require __DIR__ . '/local-setup.php'; exit; }
$config = require $configPath;
if (($config['environment'] ?? '') !== 'development' || !str_contains($config['db']['dsn'], 'host=127.0.0.1;port=3307;dbname=theatre_local;')) {
    throw new RuntimeException('This helper only supports the isolated local development database.');
}
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;charset=utf8mb4', $config['db']['user'], $config['db']['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE DATABASE IF NOT EXISTS theatre_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$pdo->exec('CREATE DATABASE IF NOT EXISTS theatre_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$pdo->exec('USE theatre_local');
require $root . '/database/migrations.php';
migrateTheatreDatabase($pdo);
$pdo->exec(file_get_contents($root . '/database/seed_faq.sql'));
if ((int) $pdo->query('SELECT COUNT(*) FROM admin')->fetchColumn() === 0) {
    $accessPath = $root . '/private/local-access.txt';
    $access = is_file($accessPath) ? file_get_contents($accessPath) : '';
    if (!preg_match('/^Password: (.+)$/m', $access, $match)) throw new RuntimeException('Local access file is missing; no credential was replaced.');
    $statement = $pdo->prepare('INSERT INTO admin (login,password_hash,created_at,updated_at) VALUES (?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())');
    $login = preg_match('/^Login: (.+)$/m', $access, $loginMatch) ? trim($loginMatch[1]) : 'local-admin';
    $statement->execute([$login, password_hash(trim($match[1]), PASSWORD_DEFAULT)]);
}
echo "Local database ready. Existing content retained.\n";
