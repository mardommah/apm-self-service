-- Ticket prefix per mLITE service (A = antrean Loket, B = antrean CS), set from application settings.
SET @queue_prefix_column_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'services'
    AND `COLUMN_NAME` = 'queue_prefix'
);
SET @queue_prefix_migration = IF(
  @queue_prefix_column_exists = 0,
  'ALTER TABLE `services` ADD COLUMN `queue_prefix` ENUM(''A'', ''B'') NULL AFTER `is_active`',
  'SELECT 1'
);
PREPARE queue_prefix_statement FROM @queue_prefix_migration;
EXECUTE queue_prefix_statement;
DEALLOCATE PREPARE queue_prefix_statement;

-- Same split as before this setting existed.
UPDATE `services` SET `queue_prefix` = 'A' WHERE `code` IN ('registrasi', 'poli_umum') AND `queue_prefix` IS NULL;
UPDATE `services` SET `queue_prefix` = 'B' WHERE `code` = 'customer_service' AND `queue_prefix` IS NULL;

-- Rollback:
-- ALTER TABLE `services` DROP COLUMN `queue_prefix`;
