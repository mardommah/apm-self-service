-- Optional registration metadata; existing visits remain valid.
SET @add_destination = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'visits'
     AND column_name = 'destination_service_id') = 0,
  'ALTER TABLE `visits` ADD COLUMN `destination_service_id` int NULL AFTER `service_id`',
  'SELECT 1'
);
PREPARE add_destination_stmt FROM @add_destination;
EXECUTE add_destination_stmt;
DEALLOCATE PREPARE add_destination_stmt;

SET @add_patient_status = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'visits'
     AND column_name = 'patient_status') = 0,
  'ALTER TABLE `visits` ADD COLUMN `patient_status` enum(''baru'', ''lama'') NULL AFTER `destination_service_id`',
  'SELECT 1'
);
PREPARE add_patient_status_stmt FROM @add_patient_status;
EXECUTE add_patient_status_stmt;
DEALLOCATE PREPARE add_patient_status_stmt;

-- Rollback:
-- ALTER TABLE `visits` DROP COLUMN `patient_status`, DROP COLUMN `destination_service_id`;
