-- Poli call history for /display-poli and the admin "Riwayat Panggilan Poli" page.
-- Filled by the app when it sees a new call in SIMRS antripoli (Khanza keeps no call log).
-- Patient/poli/doctor names are copied so the history stays readable if SIMRS data changes.
CREATE TABLE IF NOT EXISTS `poli_calls` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `no_rawat` VARCHAR(17) NOT NULL,
  `kd_poli` VARCHAR(5) NOT NULL,
  `kd_dokter` VARCHAR(20) NOT NULL,
  `queue_number` VARCHAR(30) NOT NULL,
  `pasien` VARCHAR(100) NOT NULL,
  `poli` VARCHAR(100) NOT NULL,
  `dokter` VARCHAR(100) NOT NULL,
  `is_recall` BOOLEAN NOT NULL DEFAULT FALSE,
  `called_at` DATETIME NOT NULL,
  -- Set when the same doctor+poli calls the next patient (antripoli has no "done" event).
  `finished_at` DATETIME NULL,
  INDEX `idx_poli_calls_called_at` (`called_at`),
  INDEX `idx_poli_calls_slot` (`kd_dokter`, `kd_poli`, `called_at`)
);

-- Rollback:
-- DROP TABLE `poli_calls`;
