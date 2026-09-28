<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "This script is CLI-only.\n");
    exit(1);
}

$dsn = getenv('DB_DSN') ?: '';
$user = getenv('DB_USER') ?: '';
$password = getenv('DB_PASSWORD') ?: '';
$adminLogin = trim((string) getenv('ADMIN_LOGIN'));
$adminPassword = (string) getenv('ADMIN_PASSWORD');

if ($dsn === '' || $user === '' || $adminLogin === '' || strlen($adminPassword) < 12) {
    fwrite(STDERR, "Set DB_DSN, DB_USER, DB_PASSWORD, ADMIN_LOGIN and ADMIN_PASSWORD (12+ chars).\n");
    exit(1);
}

$pdo = new PDO($dsn, $user, $password, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
]);

$root = dirname(__DIR__);
require __DIR__ . '/migrations.php';
$faq = file_get_contents($root . '/database/seed_faq.sql');
if ($faq === false) {
    fwrite(STDERR, "Unable to read FAQ seed.\n");
    exit(1);
}

migrateTheatreDatabase($pdo);
$pdo->beginTransaction();
try {
    $pdo->exec($faq);
    $existing = $pdo->query('SELECT login FROM `admin` LIMIT 1')->fetchColumn();
    if ($existing !== false && $existing !== $adminLogin) throw new RuntimeException('Only one shared admin account is allowed.');
    $statement = $pdo->prepare(
        'INSERT INTO `admin` (login, password_hash, created_at, updated_at)
         VALUES (:login, :password_hash, UTC_TIMESTAMP(), UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), updated_at = UTC_TIMESTAMP()'
    );
    $statement->execute([
        'login' => $adminLogin,
        'password_hash' => password_hash($adminPassword, PASSWORD_DEFAULT),
    ]);
    $pdo->commit();
    fwrite(STDOUT, "Schema, approved FAQ and shared admin account are ready.\n");
} catch (Throwable $error) {
    $pdo->rollBack();
    fwrite(STDERR, "Seed failed. Check server logs and database settings.\n");
    exit(1);
}
