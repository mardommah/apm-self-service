-- Kiosk creates an unbound visit. First patient device scanning its QR owns it.
ALTER TABLE `visits`
  MODIFY COLUMN `device_id` varchar(255) NULL;

-- Rollback after proving no NULL rows remain:
-- ALTER TABLE `visits` MODIFY COLUMN `device_id` varchar(255) NOT NULL;
