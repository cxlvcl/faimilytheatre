<?php
declare(strict_types=1);

namespace Theatre\Controllers;

use PDO;
use Theatre\Core\App;
use Theatre\Core\HttpException;
use Theatre\Core\Request;
use Theatre\Core\Seo;
use Theatre\Core\SeoFields;
use Theatre\Core\SeoInput;
use Theatre\Core\SeoStore;
use Theatre\Core\Validator;

/** «Настройки SEO», static page SEO, venues, authors, rubrics and redirects. */
final class AdminSeoController
{
    public function __construct(private readonly App $app)
    {
    }

    public function settings(Request $request): array
    {
        $this->guard($request);
        return $this->store()->settings() + ['robots_default' => Seo::defaultRobots()];
    }

    public function saveSettings(Request $request): array
    {
        $this->guard($request);
        $errors = [];
        $values = SeoInput::settings($request->body(), $errors);
        Validator::throwIfErrors($errors);
        $this->store()->saveSettings($values);
        return $this->store()->settings() + ['robots_default' => Seo::defaultRobots()];
    }

    /** Static pages with their saved SEO and the defaults the site would use. */
    public function pages(Request $request): array
    {
        $this->guard($request);
        $saved = $this->store()->metaMap('page');
        $seo = new Seo($this->app);
        return array_map(static function (string $path) use ($saved, $seo): array {
            [$title, $description, $name] = Seo::ROUTES[$path];
            return ['path' => $path, 'name' => $name, 'default_title' => $title, 'default_description' => $description, 'url' => Seo::readableUrl($seo->absolute($path)), 'seo' => $saved[$path] ?? SeoStore::emptyMeta()];
        }, SeoStore::STATIC_PAGES);
    }

    public function savePage(Request $request): array
    {
        $this->guard($request);
        $input = $request->body();
        $path = (string) ($input['path'] ?? '');
        if (!in_array($path, SeoStore::STATIC_PAGES, true)) throw new HttpException(404, 'not_found', 'Страница не найдена');
        $errors = [];
        $meta = SeoInput::meta($input, $errors);
        if ($meta === null) $errors['seo_title'] = 'Нет полей SEO';
        Validator::throwIfErrors($errors);
        (new SeoFields($this->app))->saveMeta('page', $path, $meta, $request->files());
        foreach ($this->pages($request) as $page) if ($page['path'] === $path) return $page;
        return [];
    }

    public function venues(Request $request): array
    {
        $this->guard($request);
        return $this->store()->venues();
    }

    public function saveVenue(Request $request, ?int $id = null): array
    {
        $this->guard($request);
        $input = $request->body();
        $errors = [];
        $values = [
            'name' => Validator::text($input, 'name', 2, 200, $errors),
            'city' => trim((string) ($input['city'] ?? '')),
            'street_address' => trim((string) ($input['street_address'] ?? '')),
            'postal_code' => trim((string) ($input['postal_code'] ?? '')),
        ];
        foreach (['name', 'city', 'street_address'] as $field) if ($values[$field] !== strip_tags($values[$field])) $errors[$field] = 'Только обычный текст';
        if (mb_strlen($values['city']) > 100) $errors['city'] = 'До 100 знаков';
        if (mb_strlen($values['street_address']) > 200) $errors['street_address'] = 'До 200 знаков';
        if ($values['postal_code'] !== '' && preg_match('/^\d{6}$/', $values['postal_code']) !== 1) $errors['postal_code'] = 'Индекс — 6 цифр';
        Validator::throwIfErrors($errors);
        $pdo = $this->pdo();
        $duplicate = $pdo->prepare('SELECT id FROM venues WHERE name = :name');
        $duplicate->execute(['name' => $values['name']]);
        $owner = $duplicate->fetchColumn();
        if ($owner !== false && (int) $owner !== $id) throw new HttpException(422, 'validation_failed', 'Такая площадка уже есть', ['name' => 'Такое название уже есть']);
        if ($id === null) {
            $pdo->prepare('INSERT INTO venues (name, city, street_address, postal_code, created_at, updated_at) VALUES (:name, :city, :street_address, :postal_code, UTC_TIMESTAMP(), UTC_TIMESTAMP())')->execute($values);
        } else {
            $this->exists('venues', $id, 'Площадка не найдена');
            $pdo->prepare('UPDATE venues SET name = :name, city = :city, street_address = :street_address, postal_code = :postal_code, updated_at = UTC_TIMESTAMP() WHERE id = :id')->execute($values + ['id' => $id]);
        }
        return $this->store()->venues();
    }

    public function deleteVenue(Request $request, int $id): array
    {
        $this->guard($request);
        $this->exists('venues', $id, 'Площадка не найдена');
        $this->pdo()->prepare('DELETE FROM venues WHERE id = :id')->execute(['id' => $id]);
        return ['deleted' => true];
    }

    public function authors(Request $request): array
    {
        $this->guard($request);
        return $this->store()->authors();
    }

    public function saveAuthor(Request $request, ?int $id = null): array
    {
        $this->guard($request);
        $input = $request->body();
        $errors = [];
        $name = Validator::text($input, 'name', 2, 150, $errors);
        $position = trim((string) ($input['position'] ?? ''));
        if (mb_strlen($position) > 150) $errors['position'] = 'До 150 знаков';
        foreach (['name' => $name, 'position' => $position] as $field => $value) if ($value !== strip_tags($value)) $errors[$field] = 'Только обычный текст';
        Validator::throwIfErrors($errors);
        $pdo = $this->pdo();
        $current = null;
        if ($id === null) {
            $pdo->prepare('INSERT INTO authors (name, position, photo, created_at, updated_at) VALUES (:name, :position, \'\', UTC_TIMESTAMP(), UTC_TIMESTAMP())')->execute(['name' => $name, 'position' => $position]);
            $id = (int) $pdo->lastInsertId();
        } else {
            $current = $this->exists('authors', $id, 'Автор не найден');
            $pdo->prepare('UPDATE authors SET name = :name, position = :position, updated_at = UTC_TIMESTAMP() WHERE id = :id')->execute(['name' => $name, 'position' => $position, 'id' => $id]);
        }
        $files = $request->files();
        if (isset($files['photo']) && (int) ($files['photo']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
            $photo = $this->app->upload()->store($files['photo'], 'authors/' . $id, 600);
            $pdo->prepare('UPDATE authors SET photo = :photo WHERE id = :id')->execute(['photo' => $photo, 'id' => $id]);
            if ($current) $this->app->upload()->delete((string) $current['photo']);
        }
        return $this->store()->authors();
    }

    public function deleteAuthor(Request $request, int $id): array
    {
        $this->guard($request);
        $current = $this->exists('authors', $id, 'Автор не найден');
        $this->pdo()->prepare('DELETE FROM authors WHERE id = :id')->execute(['id' => $id]);
        $this->app->upload()->delete((string) $current['photo']);
        return ['deleted' => true];
    }

    public function rubrics(Request $request): array
    {
        $this->guard($request);
        return $this->store()->rubrics();
    }

    public function redirects(Request $request): array
    {
        $this->guard($request);
        return $this->store()->redirects();
    }

    public function saveRedirect(Request $request, ?int $id = null): array
    {
        $this->guard($request);
        $input = $request->body();
        $errors = [];
        $from = SeoInput::redirectPath((string) ($input['from_path'] ?? ''), 'from_path', $errors, false);
        $to = SeoInput::redirectPath((string) ($input['to_path'] ?? ''), 'to_path', $errors, true);
        $code = (int) ($input['status_code'] ?? 301);
        if (!in_array($code, [301, 302], true)) $errors['status_code'] = 'Тип 301 или 302';
        if (!isset($errors['from_path']) && !isset($errors['to_path']) && $from === $to) $errors['to_path'] = 'Адреса совпадают';
        if (!isset($errors['from_path']) && $from === '/') $errors['from_path'] = 'Главную страницу перенаправить нельзя';
        Validator::throwIfErrors($errors);
        if ($id !== null) $this->exists('redirects', $id, 'Редирект не найден');
        $this->app->db()->transaction(fn (PDO $pdo) => $this->store()->saveRedirect($id, $from, $to, $code, false));
        return $this->store()->redirects();
    }

    public function deleteRedirect(Request $request, int $id): array
    {
        $this->guard($request);
        $this->exists('redirects', $id, 'Редирект не найден');
        $this->store()->deleteRedirect($id);
        return ['deleted' => true];
    }

    private function exists(string $table, int $id, string $message): array
    {
        if (!in_array($table, ['venues', 'authors', 'redirects'], true)) throw new \RuntimeException('Unsafe table.');
        $statement = $this->pdo()->prepare("SELECT * FROM {$table} WHERE id = :id");
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();
        if (!is_array($row)) throw new HttpException(404, 'not_found', $message);
        return $row;
    }

    private function store(): SeoStore
    {
        return new SeoStore($this->pdo());
    }

    private function pdo(): PDO
    {
        return $this->app->db()->pdo();
    }

    private function guard(Request $request): array
    {
        $admin = $this->app->auth()->requireAdmin($request->bearerToken());
        $this->app->rateLimiter()->enforce('admin-api', 'admin-' . $admin['id'], 120, 60);
        return $admin;
    }
}
