INSERT IGNORE INTO `services` (`code`, `label`, `icon`, `is_active`)
VALUES ('vaksinasi', 'Vaksinasi', 'Syringe', TRUE);

-- Rollback: UPDATE `services` SET `is_active` = FALSE WHERE `code` = 'vaksinasi';
