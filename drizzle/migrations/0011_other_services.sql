-- Kiosk "Layanan Lainnya" strip: non-registration services shown below the main grid.
INSERT IGNORE INTO `services` (`code`, `label`, `icon`, `is_active`)
VALUES
  ('customer_service', 'Customer Service', 'Headset', TRUE),
  ('surat_keterangan', 'Surat Keterangan', 'FileText', TRUE),
  ('layanan_lainnya', 'Layanan Lainnya', 'LayoutGrid', TRUE);

-- Rollback: UPDATE `services` SET `is_active` = FALSE WHERE `code` IN ('customer_service', 'surat_keterangan', 'layanan_lainnya');
