-- Admin dashboard "Akun BPJS untuk pengujian" panel can be hidden from application settings (default shown).
SET @bpjs_test_column_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'app_settings'
    AND `COLUMN_NAME` = 'show_bpjs_test_accounts'
);
SET @bpjs_test_migration = IF(
  @bpjs_test_column_exists = 0,
  'ALTER TABLE `app_settings` ADD COLUMN `show_bpjs_test_accounts` BOOLEAN NOT NULL DEFAULT TRUE AFTER `display_youtube_playlist`',
  'SELECT 1'
);
PREPARE bpjs_test_statement FROM @bpjs_test_migration;
EXECUTE bpjs_test_statement;
DEALLOCATE PREPARE bpjs_test_statement;

-- Rollback:
-- ALTER TABLE `app_settings` DROP COLUMN `show_bpjs_test_accounts`;
