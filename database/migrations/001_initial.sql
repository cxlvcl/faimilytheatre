SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS performances (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(180) NOT NULL,
    title VARCHAR(150) NOT NULL,
    short_description VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    cover_image VARCHAR(500) NOT NULL,
    hero_image VARCHAR(500) NOT NULL,
    hero_focus_desktop_x TINYINT UNSIGNED NOT NULL DEFAULT 50,
    hero_focus_desktop_y TINYINT UNSIGNED NOT NULL DEFAULT 50,
    hero_focus_mobile_x TINYINT UNSIGNED NOT NULL DEFAULT 50,
    hero_focus_mobile_y TINYINT UNSIGNED NOT NULL DEFAULT 50,
    is_premiere BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_performances_slug (slug),
    KEY idx_performances_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    performance_id BIGINT UNSIGNED NOT NULL,
    event_date DATE NOT NULL,
    venue VARCHAR(200) NOT NULL,
    poster_image VARCHAR(500) NOT NULL,
    ticket_url VARCHAR(2048) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_events_date (event_date),
    KEY idx_events_performance (performance_id),
    CONSTRAINT fk_events_performance
        FOREIGN KEY (performance_id) REFERENCES performances (id)
        ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS faq (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    question VARCHAR(300) NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_faq_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS daily_visitors (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    visit_date DATE NOT NULL,
    visitor_hash CHAR(64) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_daily_visitors_date_hash (visit_date, visitor_hash),
    KEY idx_daily_visitors_date (visit_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS page_views (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    page_path VARCHAR(255) NOT NULL,
    visitor_hash CHAR(64) NOT NULL,
    viewed_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_page_views_viewed_at (viewed_at),
    KEY idx_page_views_path_viewed (page_path, viewed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ticket_clicks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    event_id BIGINT UNSIGNED NULL,
    visitor_hash CHAR(64) NOT NULL,
    clicked_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_ticket_clicks_clicked_at (clicked_at),
    KEY idx_ticket_clicks_event_clicked (event_id, clicked_at),
    CONSTRAINT fk_ticket_clicks_event
        FOREIGN KEY (event_id) REFERENCES events (id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `admin` (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    login VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_admin_login (login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    admin_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    last_used_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_admin_tokens_hash (token_hash),
    KEY idx_admin_tokens_admin (admin_id),
    KEY idx_admin_tokens_expires (expires_at),
    CONSTRAINT fk_admin_tokens_admin
        FOREIGN KEY (admin_id) REFERENCES `admin` (id)
        ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS franchise_applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    status ENUM('new', 'processed') NOT NULL DEFAULT 'new',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY idx_franchise_status_created (status, created_at),
    KEY idx_franchise_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

