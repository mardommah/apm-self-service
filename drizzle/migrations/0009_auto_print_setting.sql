-- Kiosk ticket pages print automatically by default. Admin can disable it from application settings.
SET @auto_print_column_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'app_settings'
    AND `COLUMN_NAME` = 'auto_print_enabled'
);
SET @auto_print_migration = IF(
  @auto_print_column_exists = 0,
  'ALTER TABLE `app_settings` ADD COLUMN `auto_print_enabled` BOOLEAN NOT NULL DEFAULT TRUE AFTER `frista_bypass_enabled`',
  'SELECT 1'
);
PREPARE auto_print_statement FROM @auto_print_migration;
EXECUTE auto_print_statement;
DEALLOCATE PREPARE auto_print_statement;

-- Rollback:
-- ALTER TABLE `app_settings` DROP COLUMN `auto_print_enabled`;
