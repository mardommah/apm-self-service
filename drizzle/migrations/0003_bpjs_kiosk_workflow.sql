-- Additive BPJS kiosk workflow. No existing visit data is changed.
CREATE TABLE IF NOT EXISTS `bpjs_kiosk_workflows` (
  `visit_id` VARCHAR(26) PRIMARY KEY,
  `state` ENUM(
    'created', 'patient_verified', 'biometric_required', 'frista_running',
    'biometric_verified', 'checked_in', 'sep_issued', 'completed',
    'cancelled', 'requires_staff'
  ) NOT NULL DEFAULT 'created',
  `card_last4` VARCHAR(4),
  `card_hash` VARCHAR(64),
  `nik_hash` VARCHAR(64),
  `no_rm` VARCHAR(32),
  `patient_name` VARCHAR(150),
  `booking_code` VARCHAR(100),
  `queue_number` VARCHAR(50),
  `no_rawat` VARCHAR(50),
  `no_sep` VARCHAR(100),
  `last_error_code` VARCHAR(80),
  `retry_count` INT NOT NULL DEFAULT 0,
  `biometric_verified_at` DATETIME,
  `checked_in_at` DATETIME,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_bpjs_workflow_visit`
    FOREIGN KEY (`visit_id`) REFERENCES `visits` (`id`) ON DELETE CASCADE,
  INDEX `idx_bpjs_workflow_state` (`state`),
  INDEX `idx_bpjs_workflow_card_hash` (`card_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Rollback (only after the BPJS integration is disabled and data exported):
-- DROP TABLE `bpjs_kiosk_workflows`;
