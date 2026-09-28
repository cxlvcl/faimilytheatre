<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') exit(1);
$app = require dirname(__DIR__) . '/api/bootstrap.php';
require __DIR__ . '/migrations.php';
try {
    migrateTheatreDatabase($app->db()->pdo());
    echo "Database schema is up to date. Existing content retained.\n";
} catch (Throwable $error) {
    $app->logger->error('Database migration failed', ['message' => $error->getMessage()]);
    fwrite(STDERR, "Database migration failed. Check the private server logs.\n");
    exit(1);
}
