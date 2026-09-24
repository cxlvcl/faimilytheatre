<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$app = require dirname(__DIR__) . '/api/bootstrap.php';
if (($app->config['environment'] ?? '') !== 'development') throw new RuntimeException('Local export only.');
require dirname(__DIR__) . '/cron/backup.php';
// Backup only: do not run daily maintenance, seed data or migrations.
$config = $app->config;
$config['paths']['backups'] .= '/export-' . gmdate('Y-m-d-His') . '-' . bin2hex(random_bytes(3));
$exportApp = new \Theatre\Core\App($config, $app->logger, bin2hex(random_bytes(8)));
backupTheatre($exportApp, true);
echo "Export complete: " . $config['paths']['backups'] . "\nKeep both SQL and ZIP private.\n";
