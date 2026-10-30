-- Admin "Selesai" button marks the latest call of a visit as finished; the TV display shows "SELESAI DILAYANI".
SET @queue_calls_finished_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'queue_calls'
    AND `COLUMN_NAME` = 'finished_at'
);
SET @queue_calls_finished_migration = IF(
  @queue_calls_finished_exists = 0,
  'ALTER TABLE `queue_calls` ADD COLUMN `finished_at` DATETIME NULL AFTER `called_at`',
  'SELECT 1'
);
PREPARE queue_calls_finished_statement FROM @queue_calls_finished_migration;
EXECUTE queue_calls_finished_statement;
DEALLOCATE PREPARE queue_calls_finished_statement;

-- Rollback:
-- ALTER TABLE `queue_calls` DROP COLUMN `finished_at`;
