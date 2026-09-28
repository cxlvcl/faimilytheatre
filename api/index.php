<?php
declare(strict_types=1);

use Theatre\Controllers\AdminAuthController;
use Theatre\Controllers\AdminContentController;
use Theatre\Controllers\AdminStatsController;
use Theatre\Controllers\PublicController;
use Theatre\Core\HttpException;
use Theatre\Core\Request;
use Theatre\Core\Response;
use Theatre\Core\Router;

$app = require __DIR__ . '/bootstrap.php';
$request = new Request((string) $app->config['api_prefix']);

$origin = $request->header('origin');
if ($origin !== null && in_array($origin, $app->config['admin_allowed_origins'], true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Max-Age: 600');
}
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

if ($request->method() === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$public = new PublicController($app);
$auth = new AdminAuthController($app);
$content = new AdminContentController($app);
$stats = new AdminStatsController($app);
$router = new Router();

$router->get('/public/performances', static fn (): array => $public->performances());
$router->get('/public/performances/{slug}', static fn (Request $request, string $slug): array => $public->performance($slug));
$router->get('/public/events', static fn (): array => $public->events());
$router->get('/public/faq', static fn (): array => $public->faq());
$router->get('/public/seo', static function (Request $request) use ($app): array {
    $path = $request->query('path', '/');
    if (!is_string($path) || strlen($path) > 255) throw new HttpException(400, 'invalid_path', 'Некорректный путь');
    return (new \Theatre\Core\Seo($app))->page($path)['meta'];
});
$router->post('/public/franchise/applications', static fn (Request $request): array => $public->franchise($request));
$router->post('/public/analytics/page-view', static fn (Request $request): array => $public->pageView($request));
$router->post('/public/analytics/ticket-click', static fn (Request $request): array => $public->ticketClick($request));

$router->post('/admin/auth/login', static fn (Request $request): array => $auth->login($request));
$router->post('/admin/auth/logout', static fn (Request $request): array => $auth->logout($request));
$router->get('/admin/auth/me', static fn (Request $request): array => $auth->me($request));

$router->post('/admin/performances/reorder', static fn (Request $request): array => $content->reorderPerformances($request));
$router->post('/admin/performances/{id}/cover', static fn (Request $request, string $id): array => $content->replacePerformanceImage($request, (int) $id, 'cover'));
$router->post('/admin/performances/{id}/hero', static fn (Request $request, string $id): array => $content->replacePerformanceImage($request, (int) $id, 'hero'));
$router->get('/admin/performances', static fn (Request $request): array => $content->performances($request));
$router->post('/admin/performances', static fn (Request $request): array => $content->createPerformance($request));
$router->put('/admin/performances/{id}', static fn (Request $request, string $id): array => $content->updatePerformance($request, (int) $id));
$router->delete('/admin/performances/{id}', static fn (Request $request, string $id): array => $content->deletePerformance($request, (int) $id));

$router->post('/admin/events/{id}/poster', static fn (Request $request, string $id): array => $content->replaceEventPoster($request, (int) $id));
$router->get('/admin/events', static fn (Request $request): array => $content->events($request));
$router->post('/admin/events', static fn (Request $request): array => $content->createEvent($request));
$router->put('/admin/events/{id}', static fn (Request $request, string $id): array => $content->updateEvent($request, (int) $id));
$router->delete('/admin/events/{id}', static fn (Request $request, string $id): array => $content->deleteEvent($request, (int) $id));

$router->post('/admin/faq/reorder', static fn (Request $request): array => $content->reorderFaq($request));
$router->get('/admin/faq', static fn (Request $request): array => $content->faq($request));
$router->post('/admin/faq', static fn (Request $request): array => $content->createFaq($request));
$router->put('/admin/faq/{id}', static fn (Request $request, string $id): array => $content->updateFaq($request, (int) $id));
$router->delete('/admin/faq/{id}', static fn (Request $request, string $id): array => $content->deleteFaq($request, (int) $id));

$router->get('/admin/statistics', static fn (Request $request): array => $stats->statistics($request));
$router->get('/admin/franchise/statistics', static fn (Request $request): array => $stats->franchiseStatistics($request));
$router->get('/admin/franchise/applications', static fn (Request $request): array => $stats->applications($request));
$router->get('/admin/franchise/new-count', static fn (Request $request): array => $stats->newCount($request));
$router->patch('/admin/franchise/applications/{id}/status', static fn (Request $request, string $id): array => $stats->updateApplicationStatus($request, (int) $id));
$router->delete('/admin/franchise/applications/{id}', static fn (Request $request, string $id): array => $stats->deleteApplication($request, (int) $id));

try {
    $data = $router->dispatch($request);
    $createdPaths = [
        '/public/franchise/applications',
        '/public/analytics/page-view',
        '/public/analytics/ticket-click',
        '/admin/performances',
        '/admin/events',
        '/admin/faq',
    ];
    $status = $request->method() === 'POST' && in_array($request->path(), $createdPaths, true) ? 201 : 200;
    Response::success($data, $status, $app->requestId);
} catch (HttpException $error) {
    Response::error($error->errorCode, $error->getMessage(), $error->status, $error->fields, $app->requestId);
} catch (Throwable $error) {
    $app->logger->error('API request failed', [
        'type' => $error::class,
        'message' => $error->getMessage(),
        'path' => $request->path(),
    ]);
    Response::error('server_error', 'Внутренняя ошибка сервера', 500, [], $app->requestId);
}
