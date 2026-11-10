-- Doctor closed/leave marks for /display-kamar (SIMRS jadwal has no such flag).
-- Set from admin Pengaturan; a doctor marked for today shows TUTUP/CUTI instead of praktik status.
CREATE TABLE IF NOT EXISTS `dokter_libur` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `kd_dokter` VARCHAR(20) NOT NULL,
  `jenis` ENUM('tutup', 'cuti') NOT NULL,
  `tanggal_mulai` DATE NOT NULL,
  `tanggal_selesai` DATE NOT NULL,
  `keterangan` VARCHAR(100) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_dokter_libur_tanggal` (`tanggal_selesai`, `tanggal_mulai`)
);

-- Rollback:
-- DROP TABLE `dokter_libur`;
