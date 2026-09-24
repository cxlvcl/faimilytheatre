<?php
declare(strict_types=1);
// Local preview server only, bound to loopback. Never deploy this router.
$root = dirname(__DIR__);
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
if (str_contains($path, '..') || str_contains($path, "\0")) { http_response_code(404); exit; }
if (str_starts_with($path, '/api/')) { require $root . '/api/index.php'; return; }
$staticRoot = str_starts_with($path, '/uploads/') ? (getenv('UPLOADS_DIR') ?: $root . '/uploads') : $root . '/web/dist';
$relative = str_starts_with($path, '/uploads/') ? substr($path, 8) : $path;
$file = realpath($staticRoot . '/' . ltrim($relative, '/'));
if ($file && str_starts_with($file, realpath($staticRoot) . '/') && is_file($file) && preg_match('/\.(?:js|css|webp|png|jpe?g|svg|woff2?|ttf|otf|mp4|ico)$/i', $file)) {
    $types = ['js' => 'application/javascript', 'css' => 'text/css', 'otf' => 'font/otf', 'woff2' => 'font/woff2', 'mp4' => 'video/mp4'];
    $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($types[$extension] ?? mime_content_type($file)));
    // Safari requests byte ranges when loading and looping video.
    if ($extension === 'mp4') {
        $size = filesize($file);
        $start = 0;
        $end = $size - 1;
        header('Accept-Ranges: bytes');
        $range = $_SERVER['HTTP_RANGE'] ?? '';
        if ($range !== '') {
            if (!preg_match('/^bytes=(\d*)-(\d*)$/', $range, $match) || ($match[1] === '' && $match[2] === '')) {
                http_response_code(416); header('Content-Range: bytes */' . $size); return;
            }
            if ($match[1] === '') {
                $start = max(0, $size - (int) $match[2]);
            } else {
                $start = (int) $match[1];
                if ($match[2] !== '') $end = min($end, (int) $match[2]);
            }
            if ($start > $end || $start >= $size) {
                http_response_code(416); header('Content-Range: bytes */' . $size); return;
            }
            http_response_code(206);
            header("Content-Range: bytes {$start}-{$end}/{$size}");
        }
        $remaining = $end - $start + 1;
        header('Content-Length: ' . $remaining);
        if ($_SERVER['REQUEST_METHOD'] === 'HEAD') return;
        $stream = fopen($file, 'rb');
        fseek($stream, $start);
        while ($remaining > 0 && !feof($stream) && !connection_aborted()) {
            $chunk = fread($stream, min(262144, $remaining));
            if ($chunk === false || $chunk === '') break;
            echo $chunk;
            $remaining -= strlen($chunk);
        }
        fclose($stream);
        return;
    }
    readfile($file); return;
}
if ($path === '/sitemap.xml') require $root . '/api/seo/sitemap.php';
elseif ($path === '/robots.txt') require $root . '/api/seo/robots.php';
else require $root . '/api/seo/index.php';
