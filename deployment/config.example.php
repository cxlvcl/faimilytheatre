<?php
// Copy to private/config.php on the server. Never commit that file.
$config = require __DIR__ . '/api/config.example.php';
$config['environment'] = 'production';
$config['base_url'] = 'https://YOUR-DOMAIN.ru';
$config['db'] = ['dsn' => 'mysql:host=localhost;dbname=YOUR_DATABASE;charset=utf8mb4', 'user' => 'YOUR_DB_USER', 'password' => 'SET_ON_SERVER'];
$config['secrets'] = ['app' => 'GENERATE_64_RANDOM_HEX_CHARACTERS', 'visitor_hash' => 'GENERATE_ANOTHER_64_RANDOM_HEX_CHARACTERS'];
$config['uploads']['directory'] = dirname(__DIR__) . '/public_html/uploads';
$config['paths'] = ['logs' => __DIR__ . '/logs', 'runtime' => __DIR__ . '/runtime', 'backups' => __DIR__ . '/backups', 'vite_manifest' => __DIR__ . '/manifest.json'];
return $config;
