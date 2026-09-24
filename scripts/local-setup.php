<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$project = dirname(__DIR__);
$path = $project . '/private/config.php';
if (is_file($path)) { fwrite(STDERR, "Local config already exists; nothing overwritten.\n"); exit(1); }
$config = require $project . '/api/config.example.php';
$config['environment'] = 'development';
$config['base_url'] = 'http://127.0.0.1:8080';
$config['db'] = ['dsn' => 'mysql:host=127.0.0.1;port=3307;dbname=theatre_local;charset=utf8mb4', 'user' => 'root', 'password' => ''];
$config['secrets'] = ['app' => bin2hex(random_bytes(32)), 'visitor_hash' => bin2hex(random_bytes(32))];
$config['admin_allowed_origins'][] = 'http://127.0.0.1:1420';
if (!is_dir(dirname($path))) mkdir(dirname($path), 0700, true);
file_put_contents($path, "<?php\nreturn " . var_export($config, true) . ";\n"); chmod($path, 0600);
$pdo = new PDO('mysql:host=127.0.0.1;port=3307;charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE DATABASE IF NOT EXISTS theatre_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$pdo->exec('CREATE DATABASE IF NOT EXISTS theatre_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$pdo->exec('USE theatre_local');
require $project . '/database/migrations.php';
migrateTheatreDatabase($pdo);
$pdo->exec(file_get_contents($project . '/database/seed_faq.sql'));
// A temporary local admin credential is generated, never committed or printed.
$password = bin2hex(random_bytes(18));
$insert = $pdo->prepare('INSERT INTO admin (login,password_hash,created_at,updated_at) VALUES (?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())');
$insert->execute(['local-admin', password_hash($password, PASSWORD_DEFAULT)]);
file_put_contents($project . '/private/local-access.txt', "Local preview only\nLogin: local-admin\nPassword: {$password}\n"); chmod($project . '/private/local-access.txt', 0600);
echo "Local database initialized: 5 approved FAQ, no performances or events.\n";
