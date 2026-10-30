-- Queue calls from the admin "Panggil" button, read by the waiting-room TV display (/display).
CREATE TABLE IF NOT EXISTS `queue_calls` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `visit_id` VARCHAR(26) NOT NULL,
  `loket` INT NOT NULL,
  `is_recall` BOOLEAN NOT NULL DEFAULT FALSE,
  `called_at` DATETIME NOT NULL,
  INDEX `idx_queue_calls_called_at` (`called_at`),
  INDEX `idx_queue_calls_visit` (`visit_id`)
);

-- YouTube playlist shown on the display video column. Empty = "video tidak tersedia".
SET @display_playlist_column_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'app_settings'
    AND `COLUMN_NAME` = 'display_youtube_playlist'
);
SET @display_playlist_migration = IF(
  @display_playlist_column_exists = 0,
  'ALTER TABLE `app_settings` ADD COLUMN `display_youtube_playlist` VARCHAR(255) NOT NULL DEFAULT '''' AFTER `kiosk_return_seconds`',
  'SELECT 1'
);
PREPARE display_playlist_statement FROM @display_playlist_migration;
EXECUTE display_playlist_statement;
DEALLOCATE PREPARE display_playlist_statement;

-- Rollback:
-- DROP TABLE `queue_calls`;
-- ALTER TABLE `app_settings` DROP COLUMN `display_youtube_playlist`;
