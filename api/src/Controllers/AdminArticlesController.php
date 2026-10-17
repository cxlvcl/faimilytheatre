<?php
declare(strict_types=1);

namespace Theatre\Controllers;

use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Theatre\Core\App;
use Theatre\Core\HttpException;
use Theatre\Core\Markdown;
use Theatre\Core\Request;
use Theatre\Core\SeoFields;
use Theatre\Core\Slugger;
use Theatre\Core\Validator;

final class AdminArticlesController
{
    public function __construct(private readonly App $app)
    {
    }

    public function list(Request $request): array
    {
        $this->guard($request);
        $rows = $this->app->db()->pdo()->query(
            'SELECT * FROM articles ORDER BY published_on DESC, id DESC'
        )->fetchAll();
        $extra = $this->seo()->forAdminMany('article', array_map(static fn (array $row): int => (int) $row['id'], $rows));
        return array_map(fn (array $row): array => $this->map($row) + $extra[(int) $row['id']], $rows);
    }

    /** A photo for the article text; the editor inserts ![подпись](url) at the cursor. */
    public function uploadImage(Request $request): array
    {
        $this->guard($request);
        $files = $request->files();
        if (!$this->hasFile($files, 'image')) throw new HttpException(422, 'validation_failed', 'Выберите фото', ['image' => 'Выберите фото']);
        return ['url' => $this->app->upload()->store($files['image'], 'articles/text', 1800)];
    }

    public function create(Request $request): array
    {
        $this->guard($request);
        $values = $this->values($request->body());
        $errors = [];
        $bundle = $this->seo()->parse('article', null, $request->body(), $errors);
        Validator::throwIfErrors($errors);
        $files = $request->files();
        if (!$this->hasFile($files, 'cover_image')) {
            throw new HttpException(422, 'validation_failed', 'Обложка обязательна', ['cover_image' => 'Обложка обязательна']);
        }
        $created = null;
        try {
            $id = $this->app->db()->transaction(function (PDO $pdo) use ($values, $files, &$created): int {
                $insert = $pdo->prepare(
                    'INSERT INTO articles (slug, title, excerpt, body, cover_image, published_on, is_published, created_at, updated_at)
                     VALUES (:slug, :title, :excerpt, :body, \'\', :published_on, :is_published, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
                );
                $insert->execute(['slug' => $this->uniqueSlug($values['title'])] + $values);
                $id = (int) $pdo->lastInsertId();
                $created = $this->app->upload()->store($files['cover_image'], 'articles/' . $id, 2400);
                $pdo->prepare('UPDATE articles SET cover_image = :cover WHERE id = :id')->execute(['cover' => $created, 'id' => $id]);
                return $id;
            });
        } catch (\Throwable $error) {
            $this->app->upload()->delete($created);
            throw $error;
        }
        $this->seo()->apply('article', $id, $bundle, $files);
        return $this->get($id);
    }

    public function update(Request $request, int $id): array
    {
        $this->guard($request);
        $current = $this->row($id);
        $values = $this->values($request->body());
        $errors = [];
        $bundle = $this->seo()->parse('article', $id, $request->body(), $errors);
        Validator::throwIfErrors($errors);
        $files = $request->files();
        $newCover = null;
        try {
            if ($this->hasFile($files, 'cover_image')) {
                $newCover = $this->app->upload()->store($files['cover_image'], 'articles/' . $id, 2400);
            }
            // The slug changes only from the SEO field; the old address then answers 301.
            $statement = $this->app->db()->pdo()->prepare(
                'UPDATE articles SET title = :title, excerpt = :excerpt, body = :body, cover_image = :cover_image,
                    published_on = :published_on, is_published = :is_published, updated_at = UTC_TIMESTAMP()
                 WHERE id = :id'
            );
            $statement->execute($values + ['cover_image' => $newCover ?? $current['cover_image'], 'id' => $id]);
        } catch (\Throwable $error) {
            $this->app->upload()->delete($newCover);
            throw $error;
        }
        if ($newCover !== null) {
            $this->app->upload()->delete((string) $current['cover_image']);
        }
        $this->seo()->apply('article', $id, $bundle, $files);
        return $this->get($id);
    }

    public function delete(Request $request, int $id): array
    {
        $this->guard($request);
        $current = $this->row($id);
        $this->seo()->delete('article', $id);
        $this->app->db()->pdo()->prepare('DELETE FROM articles WHERE id = :id')->execute(['id' => $id]);
        $this->app->upload()->delete((string) $current['cover_image']);
        return ['deleted' => true];
    }

    private function values(array $input): array
    {
        $errors = [];
        $title = Validator::text($input, 'title', 3, 200, $errors);
        $excerpt = Validator::text($input, 'excerpt', 20, 500, $errors);
        $body = Validator::text($input, 'body', 50, 60000, $errors);
        foreach (['title' => $title, 'excerpt' => $excerpt] as $field => $value) {
            if ($value !== strip_tags($value) || preg_match('/[`\[\]{}<>]/u', $value) === 1) {
                $errors[$field] = 'Допустим только обычный текст';
            }
        }
        Markdown::validateArticle($body, 'body', $errors);
        $input['published_on'] ??= (new DateTimeImmutable('now', new DateTimeZone('Europe/Moscow')))->format('Y-m-d');
        $publishedOn = Validator::date($input, 'published_on', $errors);
        Validator::throwIfErrors($errors);
        return [
            'title' => $title,
            'excerpt' => $excerpt,
            'body' => str_replace("\r\n", "\n", $body),
            'published_on' => $publishedOn,
            'is_published' => Validator::boolean($input, 'is_published') ? 1 : 0,
        ];
    }

    private function uniqueSlug(string $title): string
    {
        $base = Slugger::make($title);
        $slug = $base;
        $suffix = 2;
        $statement = $this->app->db()->pdo()->prepare('SELECT 1 FROM articles WHERE slug = :slug');
        while (true) {
            $statement->execute(['slug' => $slug]);
            if ($statement->fetchColumn() === false) {
                return $slug;
            }
            $suffixText = '-' . $suffix++;
            $slug = substr($base, 0, 180 - strlen($suffixText)) . $suffixText;
        }
    }

    private function hasFile(array $files, string $field): bool
    {
        return isset($files[$field]) && (int) ($files[$field]['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
    }

    private function row(int $id): array
    {
        $statement = $this->app->db()->pdo()->prepare('SELECT * FROM articles WHERE id = :id');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        if (!is_array($row)) {
            throw new HttpException(404, 'not_found', 'Статья не найдена');
        }
        return $row;
    }

    private function get(int $id): array
    {
        return $this->map($this->row($id)) + $this->seo()->forAdmin('article', $id);
    }

    private function seo(): SeoFields
    {
        return new SeoFields($this->app);
    }

    private function map(array $row): array
    {
        $row['id'] = (int) $row['id'];
        $row['is_published'] = (bool) $row['is_published'];
        return $row;
    }

    private function guard(Request $request): array
    {
        $admin = $this->app->auth()->requireAdmin($request->bearerToken());
        $this->app->rateLimiter()->enforce('admin-api', 'admin-' . $admin['id'], 120, 60);
        return $admin;
    }
}
