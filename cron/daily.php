<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
$app = require dirname(__DIR__) . '/api/bootstrap.php';
$runtime = $app->config['paths']['runtime'];
if (!is_dir($runtime)) mkdir($runtime, 0750, true);
$lock = fopen($runtime . '/daily-cron.lock', 'c+');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) exit(0);
try {
    $pdo = $app->db()->pdo();
    $cutoff = (new DateTimeImmutable('today', new DateTimeZone('Europe/Moscow')))->modify('-30 days');
    $statement = $pdo->prepare('DELETE FROM daily_visitors WHERE visit_date < ?');
    $statement->execute([$cutoff->format('Y-m-d')]);
    $utc = $cutoff->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    foreach (['page_views' => 'viewed_at', 'ticket_clicks' => 'clicked_at'] as $table => $column) {
        $statement = $pdo->prepare("DELETE FROM {$table} WHERE {$column} < ?"); $statement->execute([$utc]);
    }
    $pdo->exec('DELETE FROM admin_tokens WHERE expires_at <= UTC_TIMESTAMP()');
    $logLimit = gmdate('Y-m-d', time() - 14 * 86400);
    foreach (glob($app->config['paths']['logs'] . '/*.log*') ?: [] as $file) {
        if (preg_match('/^(app|error)-(\d{4}-\d{2}-\d{2})\.log(?:\.\d+)?$/', basename($file), $match) && $match[2] < $logLimit) unlink($file);
    }
    foreach (glob($runtime . '/*.json') ?: [] as $file) if (is_file($file) && filemtime($file) < time() - 172800) unlink($file);
    require __DIR__ . '/backup.php';
    backupTheatre($app, (int) date('N') === 7);
    $app->logger->info('Daily maintenance completed');
    echo "Daily maintenance completed. Franchise applications and media retained.\n";
} catch (Throwable $error) {
    $app->logger->error('Daily maintenance failed', ['type' => $error::class]);
    fwrite(STDERR, "Maintenance failed; inspect private logs.\n"); exit(1);
} finally { flock($lock, LOCK_UN); fclose($lock); }
