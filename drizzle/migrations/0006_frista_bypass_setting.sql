-- Temporary Frista test mode. When enabled, the application skips the SIM RS
-- booking lookup and BPJS FKTL check-in, then sends the manually entered card
-- number and booking code directly to Frista. Keep disabled by default so the
-- production validation path remains fail-closed.
-- Use information_schema because older MySQL/MariaDB versions do not support
-- ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
SET @frista_bypass_column_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'app_settings'
    AND `COLUMN_NAME` = 'frista_bypass_enabled'
);
SET @frista_bypass_migration = IF(
  @frista_bypass_column_exists = 0,
  'ALTER TABLE `app_settings` ADD COLUMN `frista_bypass_enabled` BOOLEAN NOT NULL DEFAULT FALSE AFTER `barcode_enabled`',
  'SELECT 1'
);
PREPARE frista_bypass_statement FROM @frista_bypass_migration;
EXECUTE frista_bypass_statement;
DEALLOCATE PREPARE frista_bypass_statement;

-- Rollback:
-- ALTER TABLE `app_settings` DROP COLUMN `frista_bypass_enabled`;
