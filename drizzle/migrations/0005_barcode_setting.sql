-- Barcode starts disabled. Admin can enable it from application settings.
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` INT PRIMARY KEY,
  `barcode_enabled` BOOLEAN NOT NULL DEFAULT FALSE,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `app_settings` (`id`, `barcode_enabled`)
VALUES (1, FALSE)
ON DUPLICATE KEY UPDATE `id` = VALUES(`id`);

-- Rollback:
-- DROP TABLE `app_settings`;
