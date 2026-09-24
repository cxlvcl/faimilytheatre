<?php
declare(strict_types=1);

$projectRoot = dirname(__DIR__);
$privateRoot = $projectRoot . '/private';

return [
    'environment' => getenv('APP_ENV') ?: 'production',
    'base_url' => rtrim((string) (getenv('APP_BASE_URL') ?: 'https://example.ru'), '/'),
    'api_prefix' => '/api',
    'db' => [
        'dsn' => getenv('DB_DSN') ?: 'mysql:host=127.0.0.1;dbname=theatre;charset=utf8mb4',
        'user' => getenv('DB_USER') ?: '',
        'password' => getenv('DB_PASSWORD') ?: '',
    ],
    'secrets' => [
        'app' => getenv('APP_SECRET') ?: '',
        'visitor_hash' => getenv('VISITOR_HASH_SECRET') ?: '',
    ],
    'uploads' => [
        'directory' => getenv('UPLOADS_DIR') ?: $projectRoot . '/uploads',
        'public_prefix' => '/uploads',
        'source_max_bytes' => 15 * 1024 * 1024,
    ],
    'paths' => [
        'logs' => getenv('LOG_DIR') ?: $privateRoot . '/logs',
        'runtime' => getenv('RUNTIME_DIR') ?: $privateRoot . '/runtime',
        'backups' => getenv('BACKUP_DIR') ?: $privateRoot . '/backups',
        'vite_manifest' => getenv('VITE_MANIFEST') ?: $projectRoot . '/web/dist/.vite/manifest.json',
    ],
    'asset_base' => rtrim((string) (getenv('ASSET_BASE') ?: ''), '/'),
    'admin_token_days' => min(30, max(1, (int) (getenv('ADMIN_TOKEN_DAYS') ?: 30))),
    'admin_allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) (getenv('ADMIN_ALLOWED_ORIGINS') ?: 'tauri://localhost,https://tauri.localhost,http://tauri.localhost'))
    ))),
];
