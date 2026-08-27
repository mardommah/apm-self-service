-- Make the two patient entry points explicit on the kiosk home screen.
UPDATE `services`
SET `label` = 'Pasien Umum'
WHERE `code` = 'poli_umum';

UPDATE `services`
SET `label` = 'Pasien BPJS'
WHERE `code` = 'registrasi';

-- Rollback:
-- UPDATE `services` SET `label` = 'Poli Umum' WHERE `code` = 'poli_umum';
-- UPDATE `services` SET `label` = 'Registrasi Pasien' WHERE `code` = 'registrasi';
