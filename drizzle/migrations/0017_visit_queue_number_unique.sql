-- One printed queue number per day. NULL (tickets before 0016) is not constrained.
-- App database only; SIMRS/mLITE tables are untouched.
-- Fails without changes if today's data already holds a duplicate; find it first with:
--   SELECT DATE(created_at) d, queue_number, COUNT(*) n FROM visits
--   WHERE queue_number IS NOT NULL GROUP BY d, queue_number HAVING n > 1;
SET @queue_date_column_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'visits'
    AND `COLUMN_NAME` = 'queue_date'
);
SET @queue_date_migration = IF(
  @queue_date_column_exists = 0,
  'ALTER TABLE `visits` ADD COLUMN `queue_date` DATE AS (DATE(`created_at`)) STORED AFTER `queue_number`',
  'SELECT 1'
);
PREPARE queue_date_statement FROM @queue_date_migration;
EXECUTE queue_date_statement;
DEALLOCATE PREPARE queue_date_statement;

SET @queue_number_index_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`STATISTICS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'visits'
    AND `INDEX_NAME` = 'uq_visits_queue_date_number'
);
SET @queue_number_index_migration = IF(
  @queue_number_index_exists = 0,
  'ALTER TABLE `visits` ADD UNIQUE INDEX `uq_visits_queue_date_number` (`queue_date`, `queue_number`)',
  'SELECT 1'
);
PREPARE queue_number_index_statement FROM @queue_number_index_migration;
EXECUTE queue_number_index_statement;
DEALLOCATE PREPARE queue_number_index_statement;

-- Rollback:
-- ALTER TABLE `visits` DROP INDEX `uq_visits_queue_date_number`, DROP COLUMN `queue_date`;
