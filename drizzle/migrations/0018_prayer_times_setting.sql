-- Prayer times on the TV running text: location, coordinates and minute corrections as JSON.
-- NULL = default (Maros, Kemenag method), see app/lib/prayer-times.ts.
SET @prayer_times_column_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'app_settings'
    AND `COLUMN_NAME` = 'prayer_times'
);
SET @prayer_times_migration = IF(
  @prayer_times_column_exists = 0,
  'ALTER TABLE `app_settings` ADD COLUMN `prayer_times` JSON NULL AFTER `display_youtube_playlist`',
  'SELECT 1'
);
PREPARE prayer_times_statement FROM @prayer_times_migration;
EXECUTE prayer_times_statement;
DEALLOCATE PREPARE prayer_times_statement;

-- Rollback:
-- ALTER TABLE `app_settings` DROP COLUMN `prayer_times`;
