<?php
declare(strict_types=1);

namespace Theatre\Core;

final class Upload
{
    private readonly string $directory;
    private readonly string $publicPrefix;
    private readonly int $sourceMaxBytes;

    public function __construct(array $config)
    {
        $this->directory = rtrim((string) $config['directory'], '/');
        $this->publicPrefix = '/' . trim((string) $config['public_prefix'], '/');
        $this->sourceMaxBytes = (int) $config['source_max_bytes'];
    }

    public function store(array $file, string $relativeDirectory, int $maxSide): string
    {
        $this->assertUploadedFile($file);
        $temporary = (string) $file['tmp_name'];
        $size = (int) $file['size'];
        if ($size <= 0 || $size > $this->sourceMaxBytes) {
            throw new HttpException(422, 'invalid_upload', 'Изображение превышает допустимый размер');
        }

        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = (string) $finfo->file($temporary);
        $allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!in_array($mime, $allowed, true)) {
            throw new HttpException(422, 'invalid_upload', 'Разрешены JPG, PNG и WebP');
        }
        $dimensions = @getimagesize($temporary);
        if (!is_array($dimensions) || $dimensions[0] < 1 || $dimensions[1] < 1) {
            throw new HttpException(422, 'invalid_upload', 'Файл не является корректным изображением');
        }
        if ($dimensions[0] * $dimensions[1] > 25000000 || max($dimensions[0], $dimensions[1]) > 12000) {
            throw new HttpException(422, 'invalid_upload', 'Изображение слишком большое: максимум 25 мегапикселей');
        }

        $relativeDirectory = trim($relativeDirectory, '/');
        if (!preg_match('#^[a-z0-9/_-]+$#i', $relativeDirectory)) {
            throw new \RuntimeException('Unsafe upload directory.');
        }
        $targetDirectory = $this->directory . '/' . $relativeDirectory;
        if (!is_dir($targetDirectory) && !mkdir($concurrentDirectory = $targetDirectory, 0755, true) && !is_dir($concurrentDirectory)) {
            throw new \RuntimeException('Unable to create upload directory.');
        }
        $filename = gmdate('YmdHis') . '-' . bin2hex(random_bytes(8)) . '.webp';
        $target = $targetDirectory . '/' . $filename;

        try {
            if (extension_loaded('imagick')) {
                $this->withImagick($temporary, $target, $maxSide);
            } else {
                $this->withGd($temporary, $target, $mime, (int) $dimensions[0], (int) $dimensions[1], $maxSide);
            }
        } catch (\Throwable $error) {
            if (is_file($target)) {
                @unlink($target);
            }
            throw $error;
        }

        return $this->publicPrefix . '/' . $relativeDirectory . '/' . $filename;
    }

    public function delete(?string $publicPath): void
    {
        if ($publicPath === null || !str_starts_with($publicPath, $this->publicPrefix . '/')) {
            return;
        }
        $relative = substr($publicPath, strlen($this->publicPrefix) + 1);
        if ($relative === false || str_contains($relative, '..')) {
            return;
        }
        $file = $this->directory . '/' . $relative;
        $root = realpath($this->directory);
        $resolved = realpath($file);
        if ($root !== false && $resolved !== false && str_starts_with($resolved, $root . DIRECTORY_SEPARATOR) && is_file($resolved)) {
            @unlink($resolved);
        }
    }

    private function assertUploadedFile(array $file): void
    {
        $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_NO_FILE) {
            throw new HttpException(422, 'missing_upload', 'Изображение обязательно');
        }
        if (in_array($error, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new HttpException(422, 'upload_limit', 'Файл превышает лимит загрузки сервера (' . ini_get('upload_max_filesize') . '). Допустимый размер в приложении — 15 МБ.');
        }
        if ($error === UPLOAD_ERR_PARTIAL) {
            throw new HttpException(422, 'partial_upload', 'Изображение загрузилось не полностью. Выберите файл повторно и повторите сохранение.');
        }
        if (in_array($error, [UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE, UPLOAD_ERR_EXTENSION], true)) {
            throw new HttpException(500, 'upload_storage', 'Сервер не смог сохранить загруженный файл. Проверьте временную папку и свободное место.');
        }
        if ($error !== UPLOAD_ERR_OK || !is_uploaded_file((string) ($file['tmp_name'] ?? ''))) {
            throw new HttpException(422, 'invalid_upload', 'Не удалось принять изображение');
        }
    }

    private function withImagick(string $source, string $target, int $maxSide): void
    {
        $image = new \Imagick($source);
        $image->setIteratorIndex(0);
        if (method_exists($image, 'autoOrient')) {
            $image->autoOrient();
        } else {
            $orientation = $image->getImageOrientation();
            if (in_array($orientation, [2, 4, 5, 7], true)) $image->flopImage();
            $angle = match ($orientation) { 3, 4 => 180, 5, 6 => 90, 7, 8 => -90, default => 0 };
            if ($angle !== 0) $image->rotateImage('transparent', $angle);
            $image->setImageOrientation(1);
        }
        $width = $image->getImageWidth();
        $height = $image->getImageHeight();
        if (max($width, $height) > $maxSide) {
            $image->thumbnailImage($maxSide, $maxSide, true, true);
        }
        $image->setImageFormat('webp');
        $image->setImageCompressionQuality(85);
        $image->stripImage();
        if (!$image->writeImage($target)) {
            throw new \RuntimeException('Unable to write image.');
        }
        $image->clear();
    }

    private function withGd(
        string $source,
        string $target,
        string $mime,
        int $width,
        int $height,
        int $maxSide,
    ): void {
        if (!extension_loaded('gd') || !function_exists('imagewebp')) {
            throw new \RuntimeException('GD with WebP support or Imagick is required.');
        }
        $image = match ($mime) {
            'image/jpeg' => imagecreatefromjpeg($source),
            'image/png' => imagecreatefrompng($source),
            'image/webp' => imagecreatefromwebp($source),
            default => false,
        };
        if ($image === false) {
            throw new HttpException(422, 'invalid_upload', 'Не удалось декодировать изображение');
        }
        if ($mime === 'image/jpeg' && function_exists('exif_read_data')) {
            $exif = @exif_read_data($source);
            $orientation = is_array($exif) ? (int) ($exif['Orientation'] ?? 1) : 1;
            if (in_array($orientation, [2, 4, 5, 7], true)) imageflip($image, IMG_FLIP_HORIZONTAL);
            $angle = match ($orientation) { 3, 4 => 180, 5, 6 => -90, 7, 8 => 90, default => 0 };
            if ($angle !== 0) { $rotated = imagerotate($image, $angle, 0); if ($rotated !== false) { imagedestroy($image); $image = $rotated; } }
            $width = imagesx($image); $height = imagesy($image);
        }
        $ratio = min(1, $maxSide / max($width, $height));
        $targetWidth = max(1, (int) round($width * $ratio));
        $targetHeight = max(1, (int) round($height * $ratio));
        $canvas = imagecreatetruecolor($targetWidth, $targetHeight);
        if ($canvas === false) {
            imagedestroy($image);
            throw new \RuntimeException('Unable to allocate image canvas.');
        }
        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);
        $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
        imagefilledrectangle($canvas, 0, 0, $targetWidth, $targetHeight, $transparent);
        imagecopyresampled($canvas, $image, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);
        $written = imagewebp($canvas, $target, 85);
        imagedestroy($canvas);
        imagedestroy($image);
        if (!$written) {
            throw new \RuntimeException('Unable to write WebP image.');
        }
    }
}
