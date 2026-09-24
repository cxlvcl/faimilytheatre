<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$dsn = getenv('TEST_DB_DSN') ?: 'mysql:host=127.0.0.1;port=3307;dbname=theatre_test;charset=utf8mb4';
if (!preg_match('/dbname=theatre_test(?:;|$)/', $dsn)) throw new RuntimeException('Only the disposable theatre_test database is allowed.');
$root = dirname(__DIR__);
$pdo = new PDO($dsn, getenv('TEST_DB_USER') ?: 'root', getenv('TEST_DB_PASSWORD') ?: '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$action = getenv('TEST_ACTION') ?: 'setup';
if ($action === 'setup') {
    $pdo->exec('SET FOREIGN_KEY_CHECKS=0');
    foreach (['performances', 'events', 'faq', 'daily_visitors', 'page_views', 'ticket_clicks', 'admin', 'admin_tokens', 'franchise_applications'] as $table) $pdo->exec("DROP TABLE IF EXISTS `{$table}`");
    $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
    $pdo->exec(file_get_contents($root . '/database/migrations/001_initial.sql'));
    $pdo->exec(file_get_contents($root . '/database/seed_faq.sql'));
    require $root . '/database/migrations.php';
    migrateTheatreDatabase($pdo);
    $statement = $pdo->prepare('INSERT INTO admin (login,password_hash,created_at,updated_at) VALUES (?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())');
    $statement->execute(['test-admin', password_hash(getenv('TEST_ADMIN_PASSWORD'), PASSWORD_DEFAULT)]);
    $config = require $root . '/api/config.example.php';
    $config['environment'] = 'production';
    $config['base_url'] = 'http://127.0.0.1:8081';
    $config['db'] = ['dsn' => $dsn, 'user' => getenv('TEST_DB_USER') ?: 'root', 'password' => getenv('TEST_DB_PASSWORD') ?: ''];
    $config['secrets'] = ['app' => bin2hex(random_bytes(32)), 'visitor_hash' => bin2hex(random_bytes(32))];
    $directory = getenv('TEST_RUNTIME');
    $config['uploads']['directory'] = $directory . '/uploads';
    $config['paths']['logs'] = $directory . '/logs';
    $config['paths']['runtime'] = $directory . '/runtime';
    $config['paths']['backups'] = $directory . '/backups';
    mkdir($config['uploads']['directory'], 0700, true);
    file_put_contents(getenv('THEATRE_CONFIG_FILE'), "<?php return " . var_export($config, true) . ";\n"); chmod(getenv('THEATRE_CONFIG_FILE'), 0600);
    echo json_encode(['setup' => true]);
} elseif ($action === 'migrate') {
    require $root . '/database/migrations.php';
    migrateTheatreDatabase($pdo);
    echo '{}';
} elseif ($action === 'inspect') {
    $config = require getenv('THEATRE_CONFIG_FILE');
    $tables = [];
    foreach (['performances','events','faq','admin_tokens','daily_visitors','page_views','ticket_clicks','franchise_applications'] as $table) $tables[$table] = (int) $pdo->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
    $tables['tokens'] = $pdo->query('SELECT token_hash, expires_at, created_at FROM admin_tokens')->fetchAll();
    $tables['visitor_hash'] = $pdo->query('SELECT visitor_hash FROM daily_visitors LIMIT 1')->fetchColumn();
    $tables['phone'] = $pdo->query('SELECT phone FROM franchise_applications LIMIT 1')->fetchColumn();
    $tables['images'] = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($config['uploads']['directory'], FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) if ($file->isFile()) { $size = getimagesize($file->getPathname()); $tables['images'][] = ['mime' => $size['mime'], 'width' => $size[0], 'height' => $size[1]]; }
    echo json_encode($tables);
} elseif ($action === 'age') {
    $pdo->exec("INSERT INTO daily_visitors (visit_date,visitor_hash,created_at) VALUES (DATE_SUB(CURDATE(),INTERVAL 40 DAY),REPEAT('a',64),DATE_SUB(UTC_TIMESTAMP(),INTERVAL 40 DAY))");
    $pdo->exec("INSERT INTO page_views (page_path,visitor_hash,viewed_at) VALUES ('/',REPEAT('a',64),DATE_SUB(UTC_TIMESTAMP(),INTERVAL 40 DAY))");
    $pdo->exec("UPDATE events SET event_date=DATE_SUB(CURDATE(),INTERVAL 1 DAY)");
    echo '{}';
} elseif ($action === 'backup') {
    $app = require $root . '/api/bootstrap.php';
    require $root . '/cron/backup.php'; backupTheatre($app, true); echo '{}';
} else throw new RuntimeException('Unknown test action');
