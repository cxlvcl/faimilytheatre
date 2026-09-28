<?php
declare(strict_types=1);
// Required by daily.php. Uses PDO, zlib and ZipArchive; no shell passwords.
function backupTheatre(\Theatre\Core\App $app, bool $weekly): void
{
    $directory = $app->config['paths']['backups'];
    if (!is_dir($directory)) mkdir($directory, 0700, true);
    $stamp = gmdate('Y-m-d');
    $temporary = $directory . '/daily-' . $stamp . '-' . bin2hex(random_bytes(4)) . '.tmp';
    $file = $directory . '/daily-' . $stamp . '.sql.gz';
    $stream = gzopen($temporary, 'wb9');
    if (!$stream) throw new RuntimeException('Cannot open backup.');
    chmod($temporary, 0600);
    $pdo = $app->db()->pdo();
    $tables = ['performances', 'events', 'faq', 'daily_visitors', 'page_views', 'ticket_clicks', 'admin', 'admin_tokens', 'franchise_applications'];
    $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $pdo->exec('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    try {
        gzwrite($stream, "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n");
        foreach ($tables as $table) {
            $schema = $pdo->query("SHOW CREATE TABLE `{$table}`")->fetch(PDO::FETCH_NUM);
            gzwrite($stream, "DROP TABLE IF EXISTS `{$table}`;\n" . $schema[1] . ";\n");
            $query = $pdo->query("SELECT * FROM `{$table}`");
            while ($row = $query->fetch(PDO::FETCH_ASSOC)) {
                $columns = implode(',', array_map(static fn($column) => '`' . $column . '`', array_keys($row)));
                $values = implode(',', array_map(static fn($value) => $value === null ? 'NULL' : $pdo->quote((string) $value), $row));
                if (gzwrite($stream, "INSERT INTO `{$table}` ({$columns}) VALUES ({$values});\n") === false) throw new RuntimeException('Backup disk write failed.');
            }
        }
        gzwrite($stream, "SET FOREIGN_KEY_CHECKS=1;\n");
        $pdo->commit();
    } catch (Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); gzclose($stream); @unlink($temporary); throw $error; }
    gzclose($stream);
    if (!rename($temporary, $file)) throw new RuntimeException('Cannot publish backup.');
    if ($weekly) {
        if (!class_exists(ZipArchive::class)) throw new RuntimeException('ZipArchive is required for weekly backup.');
        $zipPath = $directory . '/weekly-' . $stamp . '.zip';
        $zip = new ZipArchive();
        if ($zip->open($zipPath . '.tmp', ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) throw new RuntimeException('Cannot create archive.');
        $zip->addFile($file, 'database.sql.gz');
        $uploads = realpath($app->config['uploads']['directory']);
        if ($uploads) {
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($uploads, FilesystemIterator::SKIP_DOTS));
            foreach ($iterator as $entry) if ($entry->isFile() && !$entry->isLink()) $zip->addFile($entry->getPathname(), 'uploads/' . substr($entry->getPathname(), strlen($uploads) + 1));
        }
        if (!$zip->close()) throw new RuntimeException('Cannot finish archive.');
        chmod($zipPath . '.tmp', 0600);
        if (!rename($zipPath . '.tmp', $zipPath)) throw new RuntimeException('Cannot publish archive.');
    }
    foreach (['daily-*.sql.gz' => 7, 'weekly-*.zip' => 4] as $pattern => $keep) {
        $files = glob($directory . '/' . $pattern) ?: []; rsort($files);
        foreach (array_slice($files, $keep) as $expired) unlink($expired);
    }
}
