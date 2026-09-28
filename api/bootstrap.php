<?php
declare(strict_types=1);

use Theatre\Core\App;
use Theatre\Core\Logger;
use Theatre\Core\Response;

error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
date_default_timezone_set('UTC');

spl_autoload_register(static function (string $class): void {
    $prefix = 'Theatre\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = __DIR__ . '/src/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

$defaultConfig = dirname(__DIR__) . '/private/config.php';
// Hosting package stores api/ and config.php next to each other in private/.
if (!is_file($defaultConfig) && is_file(dirname(__DIR__) . '/config.php')) {
    $defaultConfig = dirname(__DIR__) . '/config.php';
}
$configPath = (string) (getenv('THEATRE_CONFIG_FILE') ?: $defaultConfig);
$config = is_file($configPath) ? require $configPath : require __DIR__ . '/config.example.php';
if (!is_array($config)) {
    throw new RuntimeException('Invalid application configuration.');
}

$requestId = bin2hex(random_bytes(8));
$logger = new Logger($config['paths']['logs'], $requestId);

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

set_exception_handler(static function (Throwable $error) use ($logger, $config, $requestId): void {
    $logger->error('Unhandled exception', [
        'type' => $error::class,
        'message' => $error->getMessage(),
    ]);
    if (!headers_sent()) {
        Response::error(
            'server_error',
            'Внутренняя ошибка сервера',
            500,
            [],
            $requestId,
            $config['environment'] === 'development' ? ['debug' => $error->getMessage()] : []
        );
    }
});

return new App($config, $logger, $requestId);
