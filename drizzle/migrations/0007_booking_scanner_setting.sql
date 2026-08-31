-- Booking QR camera scanner is opt-in. Manual check-in remains available.
SET @booking_scanner_column_exists = (
  SELECT COUNT(*)
  FROM `information_schema`.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'app_settings'
    AND `COLUMN_NAME` = 'booking_scanner_enabled'
);
SET @booking_scanner_migration = IF(
  @booking_scanner_column_exists = 0,
  'ALTER TABLE `app_settings` ADD COLUMN `booking_scanner_enabled` BOOLEAN NOT NULL DEFAULT FALSE AFTER `barcode_enabled`',
  'SELECT 1'
);
PREPARE booking_scanner_statement FROM @booking_scanner_migration;
EXECUTE booking_scanner_statement;
DEALLOCATE PREPARE booking_scanner_statement;

-- Rollback:
-- ALTER TABLE `app_settings` DROP COLUMN `booking_scanner_enabled`;
