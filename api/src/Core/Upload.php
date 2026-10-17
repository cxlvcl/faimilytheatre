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

    /**
     * @param array{0:int,1:int}|null $crop Exact size, centre-cropped, saved as JPEG (link previews:
     *        VK and Telegram read JPEG everywhere). Without it: WebP, longest side at most $maxSide.
     */
    public function store(array $file, string $relativeDirectory, int $maxSide, ?array $crop = null): string
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
        $filename = gmdate('YmdHis') . '-' . bin2hex(random_bytes(8)) . ($crop ? '.jpg' : '.webp');
        $target = $targetDirectory . '/' . $filename;

        try {
            if (extension_loaded('imagick')) {
                $this->withImagick($temporary, $target, $maxSide, $crop);
            } else {
                $this->withGd($temporary, $target, $mime, (int) $dimensions[0], (int) $dimensions[1], $maxSide, $crop);
            }
        } catch (\Throwable $error) {
            if (is_file($target)) {
                @unlink($target);
            }
            throw $error;
        }

        return $this->publicPrefix . '/' . $relativeDirectory . '/' . $filename;
    }

    /**
     * A 1200×630 JPEG copy of a stored image for link previews (VK and Telegram), made once and
     * cached next to the uploads; null when the source is missing or cannot be converted.
     */
    public function previewJpeg(?string $publicPath): ?string
    {
        if ($publicPath === null || !str_starts_with($publicPath, $this->publicPrefix . '/') || str_contains($publicPath, '..')) return null;
        $source = $this->directory . '/' . substr($publicPath, strlen($this->publicPrefix) + 1);
        if (!is_file($source)) return null;
        $name = $this->previewName($publicPath, $source);
        $target = $this->directory . '/' . $name;
        if (!is_file($target)) {
            try {
                if (!is_dir(dirname($target)) && !mkdir(dirname($target), 0755, true) && !is_dir(dirname($target))) return null;
                $temporary = $target . '.' . bin2hex(random_bytes(4)) . '.tmp';
                if (extension_loaded('imagick')) {
                    $this->withImagick($source, $temporary, 1200, [1200, 630, 'contain']);
                } else {
                    $size = @getimagesize($source);
                    if (!is_array($size)) return null;
                    $this->withGd($source, $temporary, (string) $size['mime'], (int) $size[0], (int) $size[1], 1200, [1200, 630, 'contain']);
                }
                rename($temporary, $target);
            } catch (\Throwable) {
                if (isset($temporary) && is_file($temporary)) @unlink($temporary);
                return null;
            }
        }
        return $this->publicPrefix . '/' . $name;
    }

    private function previewName(string $publicPath, string $source): string
    {
        return 'og/' . substr(hash('sha256', $publicPath . '|' . filemtime($source) . '|contain'), 0, 24) . '.jpg';
    }

    /** Pixel size of a stored upload, or null when the file is missing. */
    public function dimensions(?string $publicPath): ?array
    {
        if ($publicPath === null || !str_starts_with($publicPath, $this->publicPrefix . '/') || str_contains($publicPath, '..')) return null;
        $size = @getimagesize($this->directory . '/' . substr($publicPath, strlen($this->publicPrefix) + 1));
        return is_array($size) && $size[0] > 0 ? [(int) $size[0], (int) $size[1]] : null;
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
            // Its link-preview copy goes with it.
            $preview = $this->directory . '/' . $this->previewName($publicPath, $resolved);
            if (is_file($preview)) @unlink($preview);
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

    private function withImagick(string $source, string $target, int $maxSide, ?array $crop = null): void
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
        if ($crop) {
            $contain = ($crop[2] ?? 'cover') === 'contain';
            $image->setImageBackgroundColor($contain ? '#080808' : 'white');
            $image = $image->mergeImageLayers(\Imagick::LAYERMETHOD_FLATTEN);
            if ($contain) {
                // The whole picture on the site's dark background (portrait posters keep their faces).
                $image->thumbnailImage($crop[0], $crop[1], true);
                $image->extentImage($crop[0], $crop[1], -intdiv($crop[0] - $image->getImageWidth(), 2), -intdiv($crop[1] - $image->getImageHeight(), 2));
            } else {
                $image->cropThumbnailImage($crop[0], $crop[1]);
            }
            $image->setImagePage(0, 0, 0, 0);
            $image->setImageFormat('jpeg');
            $image->setImageCompressionQuality(85);
            $image->stripImage();
            if (!$image->writeImage($target)) throw new \RuntimeException('Unable to write image.');
            $image->clear();
            return;
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
        ?array $crop = null,
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
        if ($crop) {
            // Centre crop to the target aspect ratio, then scale to the exact size on white.
            $contain = ($crop[2] ?? 'cover') === 'contain';
            $canvas = imagecreatetruecolor($crop[0], $crop[1]);
            if ($canvas === false) { imagedestroy($image); throw new \RuntimeException('Unable to allocate image canvas.'); }
            if ($contain) {
                imagefill($canvas, 0, 0, (int) imagecolorallocate($canvas, 8, 8, 8));
                $scale = min($crop[0] / $width, $crop[1] / $height);
                $drawWidth = (int) round($width * $scale);
                $drawHeight = (int) round($height * $scale);
                imagecopyresampled($canvas, $image, intdiv($crop[0] - $drawWidth, 2), intdiv($crop[1] - $drawHeight, 2), 0, 0, $drawWidth, $drawHeight, $width, $height);
            } else {
                $scale = max($crop[0] / $width, $crop[1] / $height);
                $sourceWidth = (int) round($crop[0] / $scale);
                $sourceHeight = (int) round($crop[1] / $scale);
                imagefill($canvas, 0, 0, (int) imagecolorallocate($canvas, 255, 255, 255));
                imagecopyresampled($canvas, $image, 0, 0, intdiv($width - $sourceWidth, 2), intdiv($height - $sourceHeight, 2), $crop[0], $crop[1], $sourceWidth, $sourceHeight);
            }
            $written = imagejpeg($canvas, $target, 85);
            imagedestroy($canvas);
            imagedestroy($image);
            if (!$written) throw new \RuntimeException('Unable to write JPEG image.');
            return;
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
