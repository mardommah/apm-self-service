-- ─── Services ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `services` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) UNIQUE NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `icon` VARCHAR(50),
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Admins ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(100) UNIQUE NOT NULL,
  `password` TEXT NOT NULL,
  `role` ENUM('admin','security') NOT NULL DEFAULT 'admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login` DATETIME
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Visits ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `visits` (
  `id` VARCHAR(26) PRIMARY KEY,
  `service_id` INT UNSIGNED NOT NULL,
  `device_id` VARCHAR(255) NOT NULL,
  `status` ENUM('waiting','served','revoked') NOT NULL DEFAULT 'waiting',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `scanned_at` DATETIME,
  `scanned_ua` TEXT,
  `served_at` DATETIME,
  `served_by` INT UNSIGNED,
  `notes` TEXT,
  CONSTRAINT `fk_visit_service` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`),
  CONSTRAINT `fk_visit_admin` FOREIGN KEY (`served_by`) REFERENCES `admins`(`id`),
  INDEX `idx_device_status` (`device_id`, `status`),
  INDEX `idx_created_at` (`created_at` DESC),
  INDEX `idx_service_id` (`service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── Seed: Services ──────────────────────────────────────────────────────────
INSERT INTO `services` (`code`, `label`, `icon`, `is_active`) VALUES
  ('registrasi',   'Registrasi Pasien', 'ClipboardList', TRUE),
  ('poli_umum',    'Poli Umum',         'Stethoscope',   TRUE),
  ('igd',          'IGD',               'Ambulance',     TRUE),
  ('laboratorium', 'Laboratorium',      'FlaskConical',  TRUE)
ON DUPLICATE KEY UPDATE `label` = VALUES(`label`);

-- ─── Seed: Default Admin ─────────────────────────────────────────────────────
-- Password: admin123 (ganti setelah deploy!)
-- Hash generated with bcrypt rounds=12
INSERT INTO `admins` (`username`, `password`, `role`) VALUES
  ('admin', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY2p7YKCdJAGNgq', 'admin'),
  ('security', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY2p7YKCdJAGNgq', 'security')
ON DUPLICATE KEY UPDATE `role` = VALUES(`role`);
