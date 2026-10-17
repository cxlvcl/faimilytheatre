<?php
declare(strict_types=1);

namespace Theatre\Core;

/**
 * Validates (before the main save) and applies (after it) the SEO tab, «Вопросы и ответы»,
 * alt texts, details and links of a performance, an article or an afisha date.
 */
final class SeoFields
{
    private const ALT_FIELDS = ['performance' => ['cover_image', 'hero_image'], 'article' => ['cover_image'], 'event' => ['poster_image']];

    public function __construct(private readonly App $app)
    {
    }

    public function store(): SeoStore
    {
        return new SeoStore($this->app->db()->pdo());
    }

    /** @param 'performance'|'article'|'event' $type */
    public function parse(string $type, ?int $id, array $input, array &$errors): array
    {
        $pdo = $this->app->db()->pdo();
        $bundle = ['alts' => SeoInput::alts($input, self::ALT_FIELDS[$type], $errors)];
        if ($type === 'event') {
            $bundle['cancelled'] = array_key_exists('is_cancelled_present', $input) ? Validator::boolean($input, 'is_cancelled') : null;
            return $bundle;
        }
        $bundle['meta'] = SeoInput::meta($input, $errors);
        $bundle['faq'] = SeoInput::faq($input, $errors);
        $bundle['shared_faq'] = SeoInput::sharedFaq($input, $pdo, $errors);
        $bundle['slug'] = SeoInput::slug($input, $errors);
        if ($bundle['slug'] !== null && $bundle['slug'] !== '' && !isset($errors['slug'])) {
            $table = $type === 'performance' ? 'performances' : 'articles';
            $taken = $pdo->prepare("SELECT id FROM {$table} WHERE slug = :slug");
            $taken->execute(['slug' => $bundle['slug']]);
            $owner = $taken->fetchColumn();
            if ($owner !== false && (int) $owner !== $id) $errors['slug'] = 'Такой адрес уже занят';
        }
        if ($type === 'performance') {
            $bundle['details'] = SeoInput::performanceDetails($input, $errors);
            $bundle['links'] = SeoInput::linkedIds($input, 'article_ids', 'articles', $pdo, $errors);
        } else {
            $bundle['links'] = SeoInput::linkedIds($input, 'performance_ids', 'performances', $pdo, $errors);
            $bundle['article'] = $this->articleDetails($input, $errors);
        }
        return $bundle;
    }

    public function apply(string $type, int $id, array $bundle, array $files): void
    {
        $store = $this->store();
        $pdo = $this->app->db()->pdo();
        if ($bundle['alts'] !== null) $store->saveAlts($type, $id, $bundle['alts']);
        if ($type === 'event') {
            if ($bundle['cancelled'] !== null) $store->saveCancelled($id, $bundle['cancelled']);
            return;
        }
        if ($bundle['slug'] !== null && $bundle['slug'] !== '') {
            [$table, $prefix] = $type === 'performance' ? ['performances', '/repertoire/'] : ['articles', '/articles/'];
            $current = $pdo->prepare("SELECT slug FROM {$table} WHERE id = :id");
            $current->execute(['id' => $id]);
            $old = (string) $current->fetchColumn();
            if ($old !== $bundle['slug']) {
                $update = $pdo->prepare("UPDATE {$table} SET slug = :slug, updated_at = UTC_TIMESTAMP() WHERE id = :id");
                $update->execute(['slug' => $bundle['slug'], 'id' => $id]);
                $store->slugChanged($prefix . $old, $prefix . $bundle['slug']);
            }
        }
        if ($bundle['meta'] !== null) $this->saveMeta($type, (string) $id, $bundle['meta'], $files);
        if ($bundle['faq'] !== null) $store->saveFaq($type, $id, $bundle['faq']);
        if ($bundle['shared_faq'] !== null) $store->saveSharedFaq($type, $id, $bundle['shared_faq']);
        if ($type === 'performance' && $bundle['details'] !== null) $store->savePerformanceDetails($id, $bundle['details']);
        if ($bundle['links'] !== null) $store->saveLinks($type, $id, $bundle['links']);
        if ($type === 'article' && $bundle['article'] !== null) {
            $store->saveArticleDetails($id, $bundle['article']['author_id'], $bundle['article']['rubric_id'], $bundle['article']['updated_on']);
        }
    }

    /** SEO tab of a performance, an article or a static page (target key = id or path). */
    public function saveMeta(string $type, string $key, array $meta, array $files): void
    {
        $store = $this->store();
        $current = $store->meta($type, $key) ?? SeoStore::emptyMeta();
        $image = $current['og_image'];
        $size = [$current['og_image_width'], $current['og_image_height']];
        $previous = null;
        if (isset($files['og_image']) && (int) ($files['og_image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
            $previous = $image;
            $image = $this->app->upload()->store($files['og_image'], 'seo/' . $type . '-' . preg_replace('/[^a-z0-9]+/', '-', strtolower($key) ?: 'home'), 1200, [1200, 630]);
            $size = [1200, 630];
        } elseif ($meta['og_image_remove']) {
            $previous = $image;
            $image = '';
            $size = [null, null];
        }
        try {
            $store->saveMeta($type, $key, $meta + ['og_image' => $image, 'og_image_width' => $size[0], 'og_image_height' => $size[1]]);
        } catch (\Throwable $error) {
            if ($image !== $current['og_image']) $this->app->upload()->delete($image);
            throw $error;
        }
        if ($previous !== null && $previous !== '' && $previous !== $image) $this->app->upload()->delete($previous);
    }

    /** Everything the admin form needs for one item. */
    public function forAdmin(string $type, int $id): array
    {
        return $this->forAdminMany($type, [$id])[$id];
    }

    /** @return array<int, array> the admin form data of several items with a fixed number of queries */
    public function forAdminMany(string $type, array $ids): array
    {
        $store = $this->store();
        $alts = $store->altsMap($type, $ids);
        $result = [];
        if ($type === 'event') {
            $cancelled = $store->cancelledMap();
            foreach ($ids as $id) {
                $result[$id] = ['poster_image_alt' => $alts[$id]['poster_image'] ?? '', 'is_cancelled' => $cancelled[$id] ?? false];
            }
            return $result;
        }
        $meta = $store->metaMap($type);
        $faq = $store->faqMap($type);
        $shared = $store->sharedFaqMap($type);
        $links = $store->links($type === 'article');
        $details = $type === 'performance' ? $store->performanceDetailsMap($ids) : $store->articleDetailsMap();
        foreach ($ids as $id) {
            $data = [];
            foreach (self::ALT_FIELDS[$type] as $field) $data[$field . '_alt'] = $alts[$id][$field] ?? '';
            $data['seo'] = $meta[(string) $id] ?? SeoStore::emptyMeta();
            $data['faq'] = $faq[$id] ?? [];
            $data['shared_faq_ids'] = $shared[$id] ?? [];
            if ($type === 'performance') {
                $data['details'] = $details[$id] ?? SeoStore::emptyDetails();
                $data['article_ids'] = $links[$id] ?? [];
            } else {
                $data += $details[$id] ?? ['author_id' => null, 'rubric_id' => null, 'updated_on' => null];
                $data['performance_ids'] = $links[$id] ?? [];
            }
            $result[$id] = $data;
        }
        return $result;
    }

    public function delete(string $type, int $id): void
    {
        $store = $this->store();
        $meta = $store->meta($type, (string) $id);
        if ($type !== 'event') {
            $store->deleteMeta($type, (string) $id);
            $store->deleteFaqFor($type, $id);
        }
        $store->deleteAlts($type, $id);
        if ($meta && $meta['og_image'] !== '') $this->app->upload()->delete($meta['og_image']);
    }

    private function articleDetails(array $input, array &$errors): ?array
    {
        if (!array_key_exists('article_details_present', $input)) return null;
        $pdo = $this->app->db()->pdo();
        $values = ['author_id' => null, 'rubric_id' => null, 'updated_on' => null];
        foreach (['author_id' => 'authors', 'rubric_id' => 'article_rubrics'] as $field => $table) {
            $raw = trim((string) ($input[$field] ?? ''));
            if ($raw === '') continue;
            $value = filter_var($raw, FILTER_VALIDATE_INT);
            $exists = $pdo->prepare("SELECT id FROM {$table} WHERE id = :id");
            $exists->execute(['id' => (int) $value]);
            if ($value === false || $exists->fetchColumn() === false) $errors[$field] = 'Выберите из списка';
            else $values[$field] = (int) $value;
        }
        if (trim((string) ($input['updated_on'] ?? '')) !== '') $values['updated_on'] = Validator::date($input, 'updated_on', $errors);
        return $values;
    }
}
