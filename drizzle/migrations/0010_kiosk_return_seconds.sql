-- Kiosk ticket page returns home automatically after this many seconds (default 30). Admin can change it from application settings.
SET @kiosk_return_column_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'app_settings'
    AND `COLUMN_NAME` = 'kiosk_return_seconds'
);
SET @kiosk_return_migration = IF(
  @kiosk_return_column_exists = 0,
  'ALTER TABLE `app_settings` ADD COLUMN `kiosk_return_seconds` INT NOT NULL DEFAULT 30 AFTER `auto_print_enabled`',
  'SELECT 1'
);
PREPARE kiosk_return_statement FROM @kiosk_return_migration;
EXECUTE kiosk_return_statement;
DEALLOCATE PREPARE kiosk_return_statement;

-- Rollback:
-- ALTER TABLE `app_settings` DROP COLUMN `kiosk_return_seconds`;
