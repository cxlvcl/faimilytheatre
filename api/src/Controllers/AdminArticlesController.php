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
        return array_map([$this, 'map'], $rows);
    }

    public function create(Request $request): array
    {
        $this->guard($request);
        $values = $this->values($request->body());
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
        return $this->map($this->row($id));
    }

    public function update(Request $request, int $id): array
    {
        $this->guard($request);
        $current = $this->row($id);
        $values = $this->values($request->body());
        $files = $request->files();
        $newCover = null;
        try {
            if ($this->hasFile($files, 'cover_image')) {
                $newCover = $this->app->upload()->store($files['cover_image'], 'articles/' . $id, 2400);
            }
            // The slug stays stable after publication so shared links keep working.
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
        return $this->map($this->row($id));
    }

    public function delete(Request $request, int $id): array
    {
        $this->guard($request);
        $current = $this->row($id);
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
