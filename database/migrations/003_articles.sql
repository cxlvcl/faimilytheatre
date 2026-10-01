-- Articles are managed in the desktop admin. Safe to run repeatedly.
CREATE TABLE IF NOT EXISTS articles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(180) NOT NULL,
    title VARCHAR(200) NOT NULL,
    excerpt VARCHAR(500) NOT NULL,
    body MEDIUMTEXT NOT NULL,
    cover_image VARCHAR(500) NOT NULL,
    published_on DATE NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_articles_slug (slug),
    KEY idx_articles_published (is_published, published_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
