<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$root = dirname(__DIR__);
$config = require $root . '/private/config.php';
if (($config['environment'] ?? '') !== 'development' || !str_contains($config['db']['dsn'], 'host=127.0.0.1;port=3307;dbname=theatre_local;')) {
    throw new RuntimeException('Only the local development database is supported.');
}
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$login = trim($input['login'] ?? '');
$password = $input['password'] ?? '';
if (!preg_match('/^[a-zA-Z0-9_-]{3,64}$/', $login) || strlen($password) < 8) throw new RuntimeException('Invalid local credentials.');
$pdo = new PDO($config['db']['dsn'], $config['db']['user'], $config['db']['password'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->beginTransaction();
try {
    $ids = $pdo->query('SELECT id FROM admin FOR UPDATE')->fetchAll(PDO::FETCH_COLUMN);
    if (count($ids) > 1) throw new RuntimeException('Expected one shared account.');
    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($ids) {
        $pdo->prepare('UPDATE admin SET login=?, password_hash=?, updated_at=UTC_TIMESTAMP() WHERE id=?')->execute([$login, $hash, $ids[0]]);
        $pdo->prepare('DELETE FROM admin_tokens WHERE admin_id=?')->execute([$ids[0]]);
    } else {
        $pdo->prepare('INSERT INTO admin (login,password_hash,created_at,updated_at) VALUES (?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())')->execute([$login, $hash]);
    }
    $pdo->commit();
} catch (Throwable $error) { $pdo->rollBack(); throw $error; }
$path = $root . '/private/local-access.txt';
if (file_put_contents($path, "Local preview only\nLogin: {$login}\nPassword: {$password}\n", LOCK_EX) === false) throw new RuntimeException('Cannot update local access file.');
chmod($path, 0600);
echo "Local shared account updated; previous sessions revoked.\n";
