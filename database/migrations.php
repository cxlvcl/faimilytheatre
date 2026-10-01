<?php
declare(strict_types=1);

// Safe to run on a new database, an existing installation, or an imported dump.
// Do not seed content or change administrator credentials here.
function migrateTheatreDatabase(PDO $pdo): void
{
    $pdo->exec(file_get_contents(__DIR__ . '/migrations/001_initial.sql'));
    $column = $pdo->query(
        "SELECT COUNT(*) FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'event_time'"
    );
    if ((int) $column->fetchColumn() === 0) {
        $pdo->exec(file_get_contents(__DIR__ . '/migrations/002_event_time.sql'));
    }
    $pdo->exec(file_get_contents(__DIR__ . '/migrations/003_articles.sql'));
}
