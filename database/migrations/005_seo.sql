-- SEO fields edited in the admin app (owner's spec, October 2026).
-- Only new tables and missing seed rows: existing tables and content are not changed.
-- Safe to run repeatedly.

-- Title, description, H1, canonical, noindex and Open Graph for a performance, an article or a static page.
-- target_key: the performance/article id, or the page path ('/', '/afisha', ...).
CREATE TABLE IF NOT EXISTS seo_meta (
    target_type ENUM('performance', 'article', 'page') NOT NULL,
    target_key VARCHAR(190) NOT NULL,
    title VARCHAR(200) NOT NULL DEFAULT '',
    description VARCHAR(400) NOT NULL DEFAULT '',
    h1 VARCHAR(200) NOT NULL DEFAULT '',
    canonical VARCHAR(500) NOT NULL DEFAULT '',
    noindex BOOLEAN NOT NULL DEFAULT FALSE,
    og_title VARCHAR(200) NOT NULL DEFAULT '',
    og_description VARCHAR(400) NOT NULL DEFAULT '',
    og_image VARCHAR(500) NOT NULL DEFAULT '',
    og_image_width SMALLINT UNSIGNED NULL,
    og_image_height SMALLINT UNSIGNED NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (target_type, target_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- «Описание для поиска (alt)» of an uploaded image field.
CREATE TABLE IF NOT EXISTS image_alts (
    target_type ENUM('performance', 'article', 'event', 'author') NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    field VARCHAR(40) NOT NULL,
    alt VARCHAR(250) NOT NULL,
    PRIMARY KEY (target_type, target_id, field)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- «Вопросы и ответы» under a performance or an article.
CREATE TABLE IF NOT EXISTS content_faq (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    target_type ENUM('performance', 'article') NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    question VARCHAR(150) NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_content_faq_target (target_type, target_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shared questions from the FAQ page attached to a performance or an article with a checkbox.
CREATE TABLE IF NOT EXISTS content_faq_shared (
    target_type ENUM('performance', 'article') NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    faq_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (target_type, target_id, faq_id),
    KEY idx_content_faq_shared_faq (faq_id),
    CONSTRAINT fk_content_faq_shared_faq FOREIGN KEY (faq_id) REFERENCES faq (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Site-wide settings: counters, verification codes, robots.txt, organisation data.
CREATE TABLE IF NOT EXISTS site_settings (
    name VARCHAR(64) NOT NULL,
    value MEDIUMTEXT NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Performance card: genre, author, age, duration, price «от».
CREATE TABLE IF NOT EXISTS performance_details (
    performance_id BIGINT UNSIGNED NOT NULL,
    genre VARCHAR(150) NOT NULL DEFAULT '',
    work_author VARCHAR(150) NOT NULL DEFAULT '',
    work_title VARCHAR(200) NOT NULL DEFAULT '',
    alternate_names TEXT NOT NULL,
    age_rating ENUM('0+', '3+', '6+', '12+', '16+') NULL,
    duration_min SMALLINT UNSIGNED NULL,
    duration_max SMALLINT UNSIGNED NULL,
    has_intermission BOOLEAN NOT NULL DEFAULT FALSE,
    price_from INT UNSIGNED NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (performance_id),
    CONSTRAINT fk_performance_details_performance FOREIGN KEY (performance_id) REFERENCES performances (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Venue directory; an afisha date is linked by the venue name it already stores.
CREATE TABLE IF NOT EXISTS venues (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT '',
    street_address VARCHAR(200) NOT NULL DEFAULT '',
    postal_code VARCHAR(12) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_venues_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- «Отменён» for an afisha date.
CREATE TABLE IF NOT EXISTS event_details (
    event_id BIGINT UNSIGNED NOT NULL,
    is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (event_id),
    CONSTRAINT fk_event_details_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Article authors and rubrics.
CREATE TABLE IF NOT EXISTS authors (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(150) NOT NULL,
    position VARCHAR(150) NOT NULL DEFAULT '',
    photo VARCHAR(500) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS article_rubrics (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(80) NOT NULL,
    name VARCHAR(100) NOT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_article_rubrics_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO article_rubrics (slug, name, sort_order) VALUES
    ('kuda-shodit', 'Куда сходить', 1),
    ('shkolnaya-programma', 'Школьная программа', 2),
    ('o-spektaklyah', 'О спектаклях', 3),
    ('kak-ustroen-teatr', 'Как устроен театр', 4);

-- Article: author, rubric and the manual «Дата обновления».
CREATE TABLE IF NOT EXISTS article_details (
    article_id BIGINT UNSIGNED NOT NULL,
    author_id BIGINT UNSIGNED NULL,
    rubric_id BIGINT UNSIGNED NULL,
    updated_on DATE NULL,
    PRIMARY KEY (article_id),
    CONSTRAINT fk_article_details_article FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE,
    CONSTRAINT fk_article_details_author FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE SET NULL,
    CONSTRAINT fk_article_details_rubric FOREIGN KEY (rubric_id) REFERENCES article_rubrics (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One relation for «Связанные статьи» (performance form) and «Связанные спектакли» (article form).
CREATE TABLE IF NOT EXISTS performance_articles (
    performance_id BIGINT UNSIGNED NOT NULL,
    article_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (performance_id, article_id),
    KEY idx_performance_articles_article (article_id),
    CONSTRAINT fk_performance_articles_performance FOREIGN KEY (performance_id) REFERENCES performances (id) ON DELETE CASCADE,
    CONSTRAINT fk_performance_articles_article FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- «Старый адрес → Новый адрес → 301/302»; slug changes add rows automatically.
CREATE TABLE IF NOT EXISTS redirects (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    from_path VARCHAR(255) NOT NULL,
    to_path VARCHAR(500) NOT NULL,
    status_code SMALLINT UNSIGNED NOT NULL DEFAULT 301,
    is_automatic BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_redirects_from (from_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
