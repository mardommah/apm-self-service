-- Printed queue number fixed at creation: "A001"/"B001" mLITE, "C001".."V001" app letter per service, "O001" offline.
-- Older tickets stay NULL and keep the computed number.
SET @queue_number_column_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'visits'
    AND `COLUMN_NAME` = 'queue_number'
);
SET @queue_number_migration = IF(
  @queue_number_column_exists = 0,
  'ALTER TABLE `visits` ADD COLUMN `queue_number` VARCHAR(8) NULL AFTER `notes`',
  'SELECT 1'
);
PREPARE queue_number_statement FROM @queue_number_migration;
EXECUTE queue_number_statement;
DEALLOCATE PREPARE queue_number_statement;

-- Rollback:
-- ALTER TABLE `visits` DROP COLUMN `queue_number`;
