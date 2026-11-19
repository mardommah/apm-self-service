-- Kiosk home list: BPJS entry also covers general specialist patients; general entry is named after the clinic.
UPDATE `services`
SET `label` = 'BPJS & Spesialis Umum'
WHERE `code` = 'registrasi';

UPDATE `services`
SET `label` = 'Poli Umum'
WHERE `code` = 'poli_umum';

-- Rollback:
-- UPDATE `services` SET `label` = 'Pasien BPJS' WHERE `code` = 'registrasi';
-- UPDATE `services` SET `label` = 'Pasien Umum' WHERE `code` = 'poli_umum';
