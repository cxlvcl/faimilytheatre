-- Repertoire sections; a performance may belong to several. Safe to run repeatedly.
CREATE TABLE IF NOT EXISTS performance_categories (
    performance_id BIGINT UNSIGNED NOT NULL,
    category ENUM('kids', 'school', 'adults', 'new_year') NOT NULL,
    PRIMARY KEY (performance_id, category),
    KEY idx_performance_categories_category (category),
    CONSTRAINT fk_performance_categories_performance
        FOREIGN KEY (performance_id) REFERENCES performances (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
