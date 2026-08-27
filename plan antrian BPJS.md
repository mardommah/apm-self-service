# Plan Antrian BPJS

## 1. Tujuan

Dokumen ini merencanakan integrasi kiosk `apm-self-service` dengan alur registrasi rawat jalan BPJS di mLITE. Hasil akhir yang diinginkan adalah pasien dapat memilih **Registrasi Pasien → BPJS**, memilih status pasien baru/lama dan poli, mengidentifikasi diri, memvalidasi kepesertaan serta rujukan, memperoleh booking/antrian, melakukan check-in, membuat kunjungan lokal, membuat SEP, lalu mencetak bukti.

Dokumen ini hanya rencana. Belum ada perubahan kode atau database di mLITE.

## 2. Ringkasan kondisi saat ini

### 2.1. `apm-self-service`

Alur kiosk saat ini sudah menyediakan:

- pilihan layanan dan modal registrasi;
- pilihan poli tujuan dan status pasien `baru`/`lama`;
- tiket/visit yang awalnya tidak terikat perangkat;
- kepemilikan tiket oleh perangkat pasien pertama yang memindai QR;
- penolakan pemindaian dari perangkat lain;
- tombol kembali ke home dan cetak.

Data tambahannya berada pada `visits.destination_service_id`, `visits.patient_status`, dan `visits.device_id` (`app/server/schema.ts:40-42`). Penguncian perangkat dilakukan saat scan dan menghasilkan `QR_ALREADY_SCANNED` bila tiket sudah dimiliki perangkat lain (`app/server/functions/visits.ts:106-139`). Ini cocok sebagai front door kiosk, tetapi belum memvalidasi pasien BPJS dan belum membuat data registrasi mLITE.

### 2.2. mLITE

mLITE sudah mempunyai komponen berikut:

- `plugins/anjungan`: APM lokal, check-in, SEP mandiri, cetak SEP, dan pembatasan akses anjungan ke sesi login atau jaringan lokal (`plugins/anjungan/Site.php:28-75`, `79-221`).
- `plugins/jkn_mobile`: endpoint Mobile JKN untuk token, ambil/status/batal/sisa antrian, pasien baru, check-in, jadwal, dan pengiriman Antrol (`plugins/jkn_mobile/Site.php:25-90`).
- `plugins/vclaim`: validasi peserta/rujukan, pembuatan SEP, kontrol, dan mapping poli/dokter.
- `plugins/rawat_jalan`: pembuatan serta pengelolaan `reg_periksa`.

Alur yang ada sekarang tersebar dan sebagian logic terduplikasi. Integrasi baru sebaiknya memanggil satu service/domain flow yang dapat dipakai kiosk dan endpoint lama, bukan menyalin isi controller.

## 3. Fakta alur mLITE yang sudah ada

### 3.1. Identitas pasien

- Pasien lama dicari terutama dari `pasien.no_peserta` (nomor kartu BPJS), `pasien.no_ktp` (NIK), atau `pasien.no_rkm_medis`.
- Endpoint pasien baru Mobile JKN memvalidasi nomor kartu 13 digit, NIK/KK 16 digit, biodata, alamat, dan nomor HP; lalu membuat `pasien` serta nomor RM (`plugins/jkn_mobile/Site.php:1198-1622`).
- APM mLITE juga dapat mengambil peserta VClaim berdasarkan NIK dan membuat pasien lokal bila belum ada (`plugins/anjungan/Site.php:3626-3727`).

Catatan: pembuatan pasien baru pada APM lama mengisi banyak nilai placeholder. Implementasi baru harus menentukan field wajib yang benar dan tidak diam-diam menyimpan data demografi palsu.

### 3.2. Mapping dan jadwal

- Poli BPJS dipetakan melalui `maping_poli_bpjs.kd_poli_bpjs → kd_poli_rs`.
- Dokter BPJS dipetakan melalui `maping_dokter_dpjpvclaim.kd_dokter_bpjs → kd_dokter`.
- Jadwal dan kuota bersumber dari `jadwal`, kemudian pemakaian kuota dihitung dari `reg_periksa` untuk hari ini atau `booking_registrasi` untuk tanggal mendatang (`plugins/jkn_mobile/Site.php:217-269`).
- Booking ditolak jika poli/dokter tidak ditemukan, jadwal tidak tersedia, atau kuota habis (`plugins/jkn_mobile/Site.php:310-343`, `436-442`).

### 3.3. Booking BPJS/JKN

Endpoint ambil antrian memvalidasi nomor kartu, NIK, tanggal, poli, dokter, jenis kunjungan, referensi, duplikasi, dan pasien lokal (`plugins/jkn_mobile/Site.php:271-345`). Setelah lolos, endpoint:

1. menghasilkan `no_reg` dan estimasi pelayanan;
2. menyimpan `booking_registrasi` berstatus `Belum` (`plugins/jkn_mobile/Site.php:347-389`);
3. menghasilkan `kodebooking` dan nomor antrean;
4. menyimpan korelasi BPJS pada `mlite_antrian_referensi` (`plugins/jkn_mobile/Site.php:390-425`).

Duplikasi yang sudah diperiksa adalah nomor referensi + tanggal serta nomor kartu + tanggal. Pemeriksaan aplikasi saja belum cukup untuk menghadapi dua request bersamaan; perlu unique constraint dan transaksi.

### 3.4. Check-in dan registrasi rawat jalan

Check-in mencari `mlite_antrian_referensi` lewat `kodebooking`, lalu mencari `booking_registrasi`. Booking harus masih `Belum`; status `Terdaftar` dianggap sudah check-in (`plugins/jkn_mobile/Site.php:1693-1720`).

Pada check-in, mLITE menentukan:

- `stts_daftar`: `Baru` jika belum pernah memiliki `reg_periksa`, selain itu `Lama`;
- `status_poli`: `Baru` jika belum pernah mengunjungi poli tersebut, selain itu `Lama`;
- biaya registrasi baru/lama dari `poliklinik`.

Lalu booking diubah menjadi `Terdaftar` dan dibuat `reg_periksa` dengan status awal `Belum`, `Ralan`, dan `Belum Bayar` (`plugins/jkn_mobile/Site.php:1750-1813`). Pasien baru juga dapat diberi antrean loket di `mlite_antrian_loket`, sedangkan `mutasi_berkas` menjadi sumber sebagian timestamp Antrol (`plugins/jkn_mobile/Site.php:1814-1852`).

APM lama mempunyai flow check-in serupa dan setelah sukses mengarahkan pasien ke pembuatan SEP (`plugins/anjungan/Site.php:3498-3599`).

### 3.5. SEP dan Antrol

- SEP mandiri mengambil daftar rujukan peserta dari VClaim, mencoba rujukan FKTP lalu rujukan RS, serta memeriksa fingerprint (`plugins/anjungan/Site.php:2810-2870`).
- Poli lokal dipilih dari mapping BPJS dan jadwal hari berjalan sebelum registrasi/SEP (`plugins/anjungan/Site.php:2958-2975`).
- Setelah SEP dibuat, data lokal disimpan di `bridging_sep`; dokumen dapat dicetak dari route cetak SEP (`plugins/anjungan/Site.php:3398-3433`).
- Antrol menggunakan `mlite_antrian_referensi` sebagai korelasi booking dan `mlite_antrian_referensi_taskid` untuk task 1–7. Sumber waktunya mencakup antrean loket, mutasi berkas, pemeriksaan rawat jalan, dan resep (`plugins/jkn_mobile/Site.php:3231-3459`). Task 99 digunakan untuk pembatalan.

## 4. Alur target end-to-end

### 4.1. Memulai dari kiosk

1. Pasien memilih **Registrasi Pasien**.
2. Modal meminta penjamin **BPJS**, status pasien **lama/baru**, dan poli tujuan.
3. Kiosk membuat session/ticket singkat, tetapi belum mengambil nomor antrean final.
4. QR hanya berisi token acak sekali pakai; jangan memasukkan NIK, nomor kartu, nomor rujukan, atau nomor RM di URL.
5. Perangkat pasien pertama yang membuka QR memperoleh kepemilikan session. Scan berikutnya dari perangkat lain ditolak. Perangkat kiosk tidak ikut dianggap sebagai pemilik.

### 4.2. Pasien lama

1. Minta nomor kartu BPJS atau NIK; bila perlu verifikasi tambahan tanggal lahir/OTP sesuai kebijakan rumah sakit.
2. Cari pasien lokal secara deterministik: nomor kartu → NIK → nomor RM. Jika identifier menunjuk pasien berbeda, hentikan dan minta verifikasi petugas.
3. Validasi peserta ke VClaim untuk tanggal pelayanan: aktif, identitas sesuai, kelas/hak rawat tersedia.
4. Ambil rujukan/kontrol yang masih berlaku. Pasien memilih referensi bila lebih dari satu.
5. Validasi poli pada rujukan terhadap poli yang dipilih. Tampilkan koreksi, jangan mengganti diam-diam.
6. Resolve mapping poli, dokter, jadwal, dan kuota.
7. Buat booking lokal + korelasi Antrol secara atomik.
8. Untuk kedatangan hari ini, lakukan check-in sesuai aturan waktu; buat `reg_periksa` secara atomik.
9. Buat SEP melalui VClaim. Setelah berhasil, simpan `bridging_sep` dan hubungkan dengan `no_rawat`/`kodebooking`.
10. Tampilkan dan cetak nomor antrean, poli, dokter, estimasi, kode booking, nomor RM, serta nomor SEP.

### 4.3. Pasien baru

1. Validasi peserta BPJS berdasarkan NIK/nomor kartu lebih dahulu.
2. Kumpulkan field pasien wajib. Data BPJS boleh menjadi prefill, tetapi pasien/petugas harus melengkapi data yang tidak tersedia.
3. Periksa ulang duplikasi berdasarkan nomor kartu dan NIK di dalam transaksi.
4. Buat satu record `pasien` dan nomor RM; jangan membuat placeholder untuk data yang secara bisnis wajib benar.
5. Lanjutkan ke rujukan, jadwal, booking, check-in, `reg_periksa`, dan SEP seperti pasien lama.
6. Status `baru/lama` dari UI adalah petunjuk alur. Nilai final `stts_daftar` dan `status_poli` harus dihitung server dari riwayat database, bukan dipercaya dari browser.

## 5. State machine yang disarankan

Satu record workflow/korelasi diperlukan agar proses lintas database dan BPJS dapat dilanjutkan setelah kegagalan:

`CREATED → DEVICE_CLAIMED → PATIENT_VERIFIED → REFERRAL_VERIFIED → BOOKED → CHECKED_IN → LOCAL_REGISTERED → SEP_ISSUED → COMPLETED`

State terminal/pengecualian:

- `CANCELLED`: dibatalkan pengguna/petugas dan dikirim sebagai task 99 bila sudah terdaftar di Antrol.
- `EXPIRED`: QR/session atau batas check-in lewat.
- `REQUIRES_STAFF`: konflik identitas, mapping tidak ada, fingerprint/biometrik, atau aturan BPJS membutuhkan petugas.
- `RECONCILIATION_REQUIRED`: satu sisi eksternal/lokal berhasil, sisi lain gagal.

Setiap transisi menyimpan waktu, actor/device, request key, hasil ringkas, kode error, dan korelasi (`visit_id`, `kodebooking`, `no_rawat`, `no_sep`). Jangan menyimpan payload BPJS lengkap tanpa redaksi.

## 6. Aturan dan invariant wajib

1. Satu session kiosk hanya dapat diklaim satu perangkat pasien.
2. Satu pasien tidak boleh mempunyai lebih dari satu booking aktif pada tanggal dan layanan yang dilarang aturan BPJS.
3. Satu `nomorreferensi + tanggal_periksa` hanya boleh menghasilkan satu booking aktif.
4. Satu `kodebooking` hanya menunjuk satu pasien, satu booking, dan maksimal satu `reg_periksa`.
5. Satu `no_rawat` hanya mempunyai satu SEP aktif yang relevan.
6. Nomor antrean dialokasikan di database secara concurrency-safe; pola baca nomor terakhir lalu `+1` tanpa lock tidak boleh dipakai.
7. Kuota diverifikasi dan dikurangi dalam critical section yang sama dengan pembuatan booking.
8. Status pasien/poli dihitung server dari riwayat aktual.
9. Pembuatan SEP tidak boleh diulang hanya karena browser refresh.
10. Task Antrol harus monoton: task berikutnya tidak boleh mendahului task sebelumnya, kecuali task pembatalan sesuai aturan BPJS.

## 7. Desain data minimum

### 7.1. Reuse tabel yang ada

- `pasien`: identitas dan nomor RM.
- `booking_registrasi`: booking/jadwal lokal.
- `reg_periksa`: kunjungan rawat jalan.
- `maping_poli_bpjs`, `maping_dokter_dpjpvclaim`, `jadwal`: mapping dan kapasitas.
- `mlite_antrian_referensi`: nomor kartu, nomor referensi, kode booking, jenis kunjungan.
- `mlite_antrian_referensi_taskid`: outbox/status task Antrol.
- `bridging_sep`: SEP yang telah berhasil.

### 7.2. Tambahan yang disarankan

Buat satu tabel workflow, misalnya `mlite_bpjs_kiosk_registration`, dengan minimal:

- ID/token hash, bukan token mentah;
- `apm_visit_id` sebagai korelasi ke aplikasi kiosk;
- `device_fingerprint_hash`, `claimed_at`, `expires_at`;
- `no_rkm_medis`, `nomor_kartu_masked/hash`, `nik_hash`;
- `nomor_referensi`, `kodebooking`, `no_rawat`, `no_sep`;
- `state`, `last_error_code`, `retry_count`;
- timestamps dan audit actor.

Tambahkan unique index sesuai invariant, minimal pada token hash, `apm_visit_id`, `kodebooking`, serta kombinasi referensi/tanggal untuk booking aktif. Bentuk index harus disesuaikan dengan versi MySQL dan aturan pembatalan yang berlaku.

Jangan menambah tabel antrean paralel bila field korelasi dapat ditambahkan secara aman ke tabel yang sudah ada.

## 8. API internal yang diperlukan

Gunakan endpoint server-to-server terautentikasi antara `apm-self-service` dan mLITE:

- `POST /internal/bpjs-kiosk/sessions/:id/claim`
- `POST /internal/bpjs-kiosk/sessions/:id/identify`
- `GET /internal/bpjs-kiosk/sessions/:id/referrals`
- `GET /internal/bpjs-kiosk/schedules?referral=...&date=...`
- `POST /internal/bpjs-kiosk/sessions/:id/book`
- `POST /internal/bpjs-kiosk/sessions/:id/check-in`
- `POST /internal/bpjs-kiosk/sessions/:id/issue-sep`
- `GET /internal/bpjs-kiosk/sessions/:id/result`
- `POST /internal/bpjs-kiosk/sessions/:id/cancel`

Nama route dapat mengikuti konvensi mLITE. Yang penting, controller tipis dan semua operasi memakai service yang sama dengan endpoint JKN/APM lama.

Setiap perintah menerima `Idempotency-Key`, memverifikasi state saat ini, dan mengembalikan hasil lama bila request yang sama sudah sukses. Respons publik memakai kode error stabil, bukan pesan exception/database mentah.

## 9. Transaksi, kegagalan, dan rekonsiliasi

BPJS adalah sistem eksternal sehingga tidak mungkin memakai satu transaksi ACID untuk seluruh flow. Gunakan pola berikut:

1. **Transaksi lokal singkat** untuk claim perangkat, alokasi nomor, cek kuota, booking, dan pembuatan `reg_periksa`.
2. **Idempotency record** sebelum memanggil BPJS.
3. **Outbox** untuk pengiriman Antrol/task; worker melakukan retry dengan exponential backoff dan jitter.
4. **Rekonsiliasi berkala** membandingkan workflow, `booking_registrasi`, `reg_periksa`, `bridging_sep`, referensi Antrol, dan status BPJS.
5. Retry hanya untuk timeout/5xx/koneksi. Error bisnis 4xx/metadata BPJS tidak diulang otomatis tanpa perubahan data.
6. Jika BPJS sukses tetapi respons ke aplikasi putus, cari hasil menggunakan korelasi sebelum membuat ulang.
7. Jika booking lokal sukses tetapi SEP gagal, jangan menghapus bukti secara diam-diam; tandai `RECONCILIATION_REQUIRED` atau batalkan secara eksplisit sesuai kebijakan.

Temuan risiko pada kode sekarang: `booking_registrasi` disimpan lebih dahulu dan `mlite_antrian_referensi` sesudahnya tanpa transaksi yang terlihat (`plugins/jkn_mobile/Site.php:362-425`). Check-in juga mengubah status booking sebelum menyimpan `reg_periksa` (`plugins/jkn_mobile/Site.php:1790-1813`). Refactor service perlu membungkus pasangan perubahan lokal tersebut dalam transaksi.

## 10. Keamanan dan privasi

- Endpoint publik kiosk tidak boleh bergantung hanya pada pembatasan IP; gunakan autentikasi service, rate limit, CSRF untuk browser, serta session/token berumur pendek.
- Simpan cookie kepemilikan `HttpOnly`, `Secure` (produksi), `SameSite=Lax/Strict`, dan rotasi setelah claim.
- QR memakai token acak minimal 128-bit, sekali pakai, dan kadaluarsa.
- Jangan log NIK, nomor kartu, nomor rujukan, nomor SEP, tanggal lahir, atau payload VClaim secara penuh. Terapkan masking dan retention.
- Semua validasi serta otorisasi dilakukan ulang di server.
- Cetakan dan layar otomatis kembali ke home serta membersihkan state setelah timeout.
- Akses petugas untuk override, pembatalan, dan rekonsiliasi wajib tercatat di audit log.

## 11. UX kiosk

Urutan layar minimum:

1. Pilih layanan.
2. Modal registrasi: BPJS, baru/lama, poli.
3. QR untuk melanjutkan di HP atau opsi input langsung yang aman di kiosk.
4. Identifikasi pasien.
5. Pilih rujukan/kontrol.
6. Pilih dokter/jadwal yang mapping dan kuotanya valid.
7. Konfirmasi ringkas.
8. Progress yang menunjukkan tahap nyata, bukan spinner tanpa batas.
9. Hasil: nomor antrean, estimasi, kode booking, SEP, tombol cetak, kembali ke home.

Error harus actionable: “poli belum dimapping—hubungi petugas”, “rujukan sudah digunakan”, “kuota habis”, “BPJS sedang tidak tersedia—booking belum dibuat”, atau “proses tersimpan dan sedang direkonsiliasi”.

## 12. Tahapan implementasi

### Fase 0 — keputusan dan baseline

- Konfirmasi versi spesifikasi BPJS Antrean/VClaim yang berlaku di fasilitas.
- Inventarisasi schema/index nyata dan constraint existing.
- Tentukan source of truth nomor antrean dan kebijakan booking hari ini vs mendatang.
- Catat baseline request/response teredaksi serta test environment BPJS.

### Fase 1 — konsolidasi domain mLITE

- Ekstrak logic mapping, kuota, booking, check-in, dan pembuatan `reg_periksa` ke satu service.
- Pertahankan kontrak endpoint JKN lama dengan characterization test.
- Tambahkan transaksi dan unique constraint.
- Sediakan idempotency serta workflow/audit record.

### Fase 2 — validasi BPJS dan SEP

- Bungkus lookup peserta, rujukan, fingerprint, serta create/query SEP dalam adapter VClaim.
- Tambahkan klasifikasi error retryable/non-retryable.
- Hubungkan `kodebooking ↔ no_rawat ↔ no_sep`.

### Fase 3 — integrasi kiosk

- Tambah pilihan BPJS dan halaman identifikasi/rujukan/jadwal.
- Hubungkan session QR terkunci perangkat dengan workflow mLITE.
- Tambah layar hasil, kembali home, dan cetak.

### Fase 4 — Antrol dan operasional

- Outbox task 1–7/99 dan retry worker.
- Dashboard rekonsiliasi serta aksi petugas.
- Observability dengan data sensitif teredaksi.

### Fase 5 — rollout

- Uji sandbox/staging, lalu pilot satu poli.
- Feature flag per kiosk/poli.
- Pantau duplikasi, kegagalan SEP, mismatch kuota, lag task, dan waktu penyelesaian.
- Perluas bertahap setelah acceptance criteria lulus.

## 13. Acceptance criteria

- Pasien lama aktif dengan rujukan valid memperoleh tepat satu booking, satu `reg_periksa`, satu SEP, dan satu kode booking walaupun tombol diklik ulang atau jaringan retry.
- Dua request serentak tidak dapat mengambil slot/nomor yang sama atau melewati kuota.
- Pasien baru tidak membuat duplikat berdasarkan nomor kartu/NIK dan memperoleh nomor RM sebelum booking.
- Mapping poli/dokter yang hilang menghentikan proses sebelum booking dibuat.
- QR yang telah diklaim tidak dapat dipakai perangkat lain, tetapi perangkat pemilik dapat refresh tanpa kehilangan proses.
- Kegagalan BPJS tidak meninggalkan status lokal seolah proses selesai.
- Refresh setelah SEP berhasil menampilkan hasil lama, bukan membuat SEP baru.
- Pembatalan mengubah state lokal dan mengirim task/status BPJS yang sesuai.
- Task Antrol terkirim berurutan dan retry tidak membuat duplikat.
- Data sensitif tidak tampak di URL/log aplikasi.
- Semua flow menyediakan kembali ke home dan cetak; timeout membersihkan session kiosk.

## 14. Skenario uji wajib

- pasien lama/baru; kunjungan pertama ke poli vs kunjungan ulang;
- peserta tidak aktif, identitas berbeda, rujukan tidak ada/kedaluwarsa/sudah dipakai;
- lebih dari satu rujukan;
- poli/dokter belum dimapping, dokter tidak praktik, kuota penuh;
- dua klik bersamaan dan retry request dengan idempotency key sama;
- dua perangkat memindai QR yang sama;
- timeout sebelum dan sesudah BPJS menerima create SEP;
- database gagal setelah booking, setelah check-in, dan setelah BPJS sukses;
- check-in terlalu awal/terlambat, booking sudah `Terdaftar`, pembatalan;
- printer tidak tersedia—proses tetap sukses dan dapat dicetak ulang;
- urutan task 1–7 dan task 99.

## 15. Rollback

- Seluruh endpoint lama tetap aktif selama pilot.
- Integrasi kiosk dilindungi feature flag; rollback pertama adalah mematikan flag dan mengarahkan ke flow APM lama.
- Migration hanya additive pada fase awal. Jangan drop/mengubah arti kolom lama sebelum satu siklus operasional stabil.
- Worker outbox dapat dihentikan tanpa kehilangan event; event tetap berstatus pending.
- Sediakan prosedur petugas untuk membatalkan booking/SEP yang orphan dan mencatat alasan.

## 16. Keputusan yang masih harus dikonfirmasi

1. Fasilitas ini FKTP atau FKRTL untuk flow kiosk yang dimaksud, serta versi kontrak BPJS yang aktif?
2. Apakah kiosk dipakai untuk booking mendatang, check-in hari ini, atau keduanya?
3. Apakah pasien baru boleh menyelesaikan registrasi tanpa petugas, dan field demografi apa yang wajib diverifikasi?
4. Kapan fingerprint/biometrik diwajibkan dan apa fallback resminya?
5. Nomor antrean final bersumber dari Antrol, `booking_registrasi.no_reg`, atau antrean loket?
6. Apakah SEP harus dibuat sebelum atau setelah check-in untuk SOP rumah sakit ini?
7. Printer menggunakan dialog browser, printer jaringan, atau service print lokal?
8. Berapa TTL QR/session dan aturan satu perangkat untuk pasien yang mengganti HP?

## 17. Urutan kerja pertama yang direkomendasikan

Jangan mulai dari UI. Kerjakan lebih dulu characterization test atas endpoint ambil antrian dan check-in, audit constraint database, lalu konsolidasikan transaksi booking/check-in. Setelah invariant duplikasi dan korelasi terbukti, baru hubungkan kiosk, SEP, cetak, dan task Antrol.

## 18. Integrasi Frista untuk check-in pasien BPJS

### 18.1. Hasil analisis aplikasi Frista 3.0.1

Artefak `/home/mardommah/Documents/dev/frista/frista.v.3.0.1/frista.exe` adalah aplikasi GUI Windows 64-bit yang dibundel dengan PyInstaller/Python 3.10. Aplikasi membawa OpenCV, `face_recognition`, MediaPipe, kamera, dan anti-spoofing. Frista bukan library yang dapat di-import oleh mLITE atau aplikasi kiosk.

Dari isi executable, Frista:

- membaca `config.conf`, termasuk API/environment, kamera, serta pengaturan anti-spoofing;
- login ke layanan BPJS melalui endpoint `/user/login/rs`;
- menerima pencarian nomor BPJS/NIK melalui `/face/nik2`;
- memakai `/face/recognition2` dan `/face/match2` untuk pengenalan/pencocokan wajah;
- mengunggah gambar melalui `/face/upload` atau `/face/upload2`;
- memeriksa sesi melalui `/user/session`;
- mempunyai mode **Face Recognition** dan **Face Verification**.

Frista tidak menunjukkan kontrak command-line, URL scheme, callback, atau local HTTP API. Input nomor kartu pada aplikasinya tetap berupa GUI. Karena itu integrasi existing mLITE memakai aplikasi perantara bernama **JKN Biometrik Bot**.

### 18.2. Mekanisme existing di mLITE

mLITE sudah memiliki integrasi berikut:

1. Backend mengecek status biometrik peserta ke VClaim `SEP/FingerPrint/Peserta/{no_kartu}/TglPelayanan/{tanggal}` (`plugins/anjungan/Site.php:2849-2862`).
2. Bila respons menyatakan `Peserta belum melakukan validasi finger print`, UI menawarkan Fingerprint atau Frista (`plugins/anjungan/view/sep.mandiri.noka.norm.html:200-260`).
3. Browser melakukan `POST http://localhost:3000/?app=frista` dengan `username`, `password`, `card_number`, `exit=true`, dan `wait=2000` (`plugins/anjungan/view/sep.mandiri.noka.norm.html:283-301`).
4. Service Node.js JKN Biometrik Bot harus berjalan pada komputer Windows yang sama dengan browser dan Frista. Dokumentasi instalasinya berada di `plugins/afm/view/admin/settings.html:35-54`.
5. Integrasi serupa juga dipakai form SEP petugas (`plugins/vclaim/view/admin/form.sep.html:847-910`).

`localhost` selalu berarti perangkat yang menjalankan browser. Jadi flow ini hanya bekerja bila halaman check-in dibuka pada kiosk Windows tempat bot, kamera, dan Frista terpasang. Flow tidak dapat dijalankan dari HP pasien hasil scan QR karena `localhost:3000` pada HP bukan komputer kiosk.

### 18.3. Arsitektur yang direkomendasikan

Komponen dan batas tanggung jawab:

1. **mLITE/VClaim backend** menentukan apakah biometrik diperlukan dan menjadi sumber kebenaran status verifikasi.
2. **Workflow BPJS kiosk** menyimpan state serta korelasi pasien/booking, tetapi tidak menyimpan gambar wajah.
3. **Browser kiosk Windows** meminta local agent menjalankan Frista.
4. **JKN Biometrik Bot di `127.0.0.1:3000`** membuka Frista, mengisi credential dan nomor kartu, lalu menunggu proses selesai.
5. **Frista** menangkap wajah, anti-spoofing, dan berkomunikasi langsung dengan layanan BPJS.
6. Setelah Frista selesai, **mLITE mengecek ulang status biometrik ke BPJS**. Hanya respons BPJS yang dapat membuka tahap check-in/SEP.

Status workflow ditambah:

`PATIENT_VERIFIED → BIOMETRIC_CHECKING → BIOMETRIC_REQUIRED → FRISTA_RUNNING → BIOMETRIC_VERIFIED → CHECKED_IN`

Status pengecualian:

- `BIOMETRIC_FAILED`: wajah ditolak atau status BPJS belum berubah setelah percobaan selesai;
- `BIOMETRIC_TIMEOUT`: Frista/bot tidak selesai dalam batas waktu;
- `BIOMETRIC_AGENT_UNAVAILABLE`: service `localhost:3000`, kamera, atau Frista tidak tersedia;
- `REQUIRES_STAFF`: percobaan maksimum tercapai atau diperlukan fallback biometrik resmi.

### 18.4. Alur check-in pasien lama

1. Pasien lama diidentifikasi dengan nomor kartu/NIK dan dicocokkan ke `pasien`.
2. Booking, tanggal check-in, poli, dan identitas diverifikasi, tetapi `booking_registrasi` belum diubah menjadi `Terdaftar` dan `reg_periksa` belum dibuat.
3. Backend mLITE meminta status fingerprint/biometrik peserta untuk tanggal pelayanan.
4. Jika BPJS menyatakan valid/tidak memerlukan verifikasi, flow langsung ke transaksi check-in.
5. Jika biometrik diperlukan, workflow menjadi `BIOMETRIC_REQUIRED` dan UI kiosk menampilkan persetujuan serta petunjuk kamera.
6. Browser kiosk memanggil local bot untuk membuka Frista. Hanya satu job Frista boleh berjalan per kiosk/kamera.
7. Setelah bot melaporkan aplikasi selesai, backend melakukan polling terbatas ke endpoint status BPJS, misalnya setiap 2 detik dengan batas 30–60 detik.
8. Jika BPJS mengonfirmasi validasi, workflow menjadi `BIOMETRIC_VERIFIED` lalu transaksi check-in mengubah booking menjadi `Terdaftar` dan membuat tepat satu `reg_periksa`.
9. Flow dilanjutkan ke pembuatan SEP dan cetak.
10. Jika belum valid, jangan membuat kunjungan seolah sukses. Tawarkan coba lagi atau bantuan petugas.

Walaupun fokus awal adalah pasien lama, keputusan memerlukan Frista harus selalu berdasarkan respons BPJS dan aturan pelayanan, bukan hanya nilai `patient_status=lama` dari UI.

### 18.5. Kontrak integrasi local agent

Kontrak bot existing dapat dipakai untuk pilot, tetapi perlu dibungkus adapter pada client kiosk:

```text
POST http://127.0.0.1:3000/?app=frista
Content-Type: application/x-www-form-urlencoded

username=...&password=...&card_number=...&exit=true&wait=2000
```

Sebelum memulai job, lakukan health check agent. Adapter harus membedakan:

- agent tidak terhubung;
- Frista gagal dibuka;
- proses ditutup/dibatalkan;
- timeout;
- proses selesai.

Respons `2xx` local agent **bukan** status lolos face recognition. Respons itu hanya trigger/completion signal. Status final selalu diperiksa ulang dari BPJS melalui backend.

Untuk produksi, kontrak bot sebaiknya ditingkatkan agar menerima `job_id`/token singkat, bukan credential BPJS dan nomor kartu dari HTML. Agent mengambil job yang sudah ditandatangani dari backend atau menyimpan credential secara aman di mesin kiosk. Jangan memasukkan `username_frista` dan `password_frista` ke source HTML seperti integrasi existing.

### 18.6. Dampak terhadap flow QR

Frista membutuhkan kamera dan executable Windows pada kiosk. Karena itu:

- identifikasi dan pengisian data boleh dilanjutkan melalui HP;
- tahap Frista harus dilakukan kembali pada kiosk yang membuat session;
- backend mengikat job Frista ke `visit_id`, `kiosk_id`, dan session pasien;
- kiosk hanya menampilkan/memulai job yang sudah mencapai `BIOMETRIC_REQUIRED`;
- HP dapat menampilkan pesan “Silakan lihat kamera pada kiosk” dan menunggu status;
- kiosk tidak boleh membocorkan data pasien lain ketika beberapa session menunggu.

Alternatif paling sederhana adalah menyelesaikan seluruh check-in BPJS pasien lama pada browser kiosk dan memakai QR hanya untuk tiket/hasil. Menjalankan Frista langsung dari HP tidak didukung oleh aplikasi yang dianalisis.

### 18.7. Keamanan dan operasional

- Bind bot hanya ke `127.0.0.1`, bukan `0.0.0.0`/LAN.
- Terapkan allowlist origin, token per job, masa berlaku pendek, dan proteksi replay. CORS tidak boleh `*` untuk endpoint pemicu aplikasi.
- Hindari credential Frista di DOM, log browser, network inspector, atau database workflow.
- Nomor kartu harus dimasking pada log dan layar idle.
- Jangan menyimpan foto/crop wajah di mLITE atau kiosk. Penghapusan file sementara menjadi tanggung jawab agent/Frista.
- Pastikan halaman HTTPS dapat berkomunikasi dengan loopback HTTP pada browser target; uji mixed-content, Private Network Access, firewall, antivirus, dan CORS.
- Jalankan agent sebagai user Windows terbatas, bukan Administrator.
- Sediakan watchdog/auto-start agent dan health indicator kamera/Frista.
- Serialisasi job per kamera serta beri timeout. Proses Frista yatim harus dapat dihentikan oleh petugas secara aman.
- Audit hanya metadata: workflow ID, kiosk, waktu mulai/selesai, hasil BPJS, kode kegagalan; tanpa foto atau credential.

### 18.8. Acceptance criteria khusus Frista

- Pasien yang wajib biometrik tidak dapat mencapai `CHECKED_IN`, SEP, atau cetak sukses sebelum backend mengonfirmasi status BPJS.
- HTTP `200` dari bot tanpa perubahan status BPJS menghasilkan `BIOMETRIC_FAILED`, bukan sukses.
- Refresh/double-click tidak membuka dua instance Frista untuk session yang sama.
- Kiosk lain dan HP pasien tidak dapat menjalankan job yang terikat ke kiosk asal.
- Credential Frista tidak muncul dalam HTML atau log.
- Agent mati, kamera gagal, timeout, cancel, wajah tidak cocok, dan BPJS unavailable menghasilkan state berbeda dan pesan yang dapat ditindaklanjuti.
- Setelah wajah berhasil, retry request check-in tetap menghasilkan satu `reg_periksa` dan satu SEP.
- File foto sementara dihapus sesuai retention yang disepakati dan tidak masuk backup aplikasi.

### 18.9. Bukti yang masih perlu diperoleh sebelum implementasi

Folder Frista hanya berisi binary, dependency, dan model; tidak ada dokumentasi kontrak resmi. Sebelum coding produksi, minta dan verifikasi:

1. paket/source atau dokumentasi resmi JKN Biometrik Bot yang berjalan di port 3000;
2. contoh respons sukses/gagal/timeout dari bot;
3. format dan nilai `config.conf` resmi Frista tanpa membagikan credential;
4. status VClaim yang menandakan verifikasi berhasil serta masa berlakunya;
5. SOP BPJS untuk fallback fingerprint/approval petugas;
6. izin redistribusi, update, dan kompatibilitas versi Frista;
7. hasil uji pada Windows/browser/kamera yang benar-benar dipakai kiosk.
