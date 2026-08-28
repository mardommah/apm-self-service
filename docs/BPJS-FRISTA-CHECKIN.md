# Check-in BPJS Mobile JKN dan Frista

Dokumen ini mencatat implementasi check-in BPJS pasien lama pada kiosk. Alur menggunakan satu QR check-in Mobile JKN untuk mengisi data pasien dan antrean, menjalankan validasi FKTL, membuka aplikasi biometrik Frista melalui agent lokal, lalu mencetak bukti.

## Alur pengguna

1. Pengguna memilih layanan Registrasi dan jenis Pasien Lama.
2. Dialog check-in menampilkan kamera di sisi kiri dan form di sisi kanan.
3. Pengguna memindai satu QR check-in Mobile JKN.
4. Aplikasi mendekode Base64 menjadi JSON dan mengisi nomor kartu serta kode booking.
5. Pengguna menekan tombol check-in.
6. Server memvalidasi booking melalui API BPJS FKTL.
7. Browser mengirim job bertanda tangan ke secure agent pada komputer kiosk.
8. Secure agent menjalankan JKN Biometrik Bot dan menunggu jendela utama Frista selesai atau ditutup.
9. Selama proses berlangsung, kiosk menampilkan dialog proses dan mencegah interaksi dengan halaman belakang.
10. Setelah agent merespons, kiosk mencetak bukti check-in.

Input manual tetap ditampilkan sebagai cadangan, tetapi pencetakan bukti lengkap mensyaratkan hasil pemindaian QR. Perubahan manual setelah pemindaian membatalkan data QR agar bukti yang dicetak tidak berbeda dari data yang dikirim.

## Format QR check-in

QR berisi JSON yang dikodekan sebagai Base64. Contoh struktur setelah didekode:

```json
{
  "nokapst": "0001934936482",
  "kodeBooking": "20260828000039",
  "noRujukan": "0327S0010826K000213",
  "norm": "052073",
  "ketKunjungan": "Kontrol",
  "namaFaskesAsalRujuk": null,
  "namaPoli": "MATA",
  "namaDokter": "dr. FITRI ANNUR CHIKMAH",
  "nomorAntrean": "PM -011"
}
```

Pemetaan field yang digunakan:

| Field QR | Penggunaan |
|---|---|
| `nokapst` | Nomor kartu BPJS; wajib 13 digit |
| `kodeBooking` | Kode booking untuk validasi FKTL |
| `noRujukan` | Dicetak pada bukti |
| `norm` | Dicetak sebagai nomor rekam medis |
| `namaDokter` | Dicetak pada bukti |
| `nomorAntrean` | Dicetak pada bukti; spasi berulang dinormalisasi |

Scanner menolak QR yang tidak memuat keenam field wajib tersebut. Data QR disimpan sementara di state browser dan dihapus ketika dialog ditutup atau proses selesai. Payload mentah, NIK, dan data pribadi lain tidak dicatat ke log.

## Validasi FKTL

Server menggunakan konfigurasi berikut:

```dotenv
BPJS_FKTL_BASE_URL=https://example.test/webapps/api-bpjsfktl
BPJS_FKTL_USERNAME=username
BPJS_FKTL_PASSWORD=password
BPJS_FKTL_REQUEST_TIMEOUT_MS=15000
```

Urutan request:

1. `GET {BPJS_FKTL_BASE_URL}/auth` dengan header `x-username` dan `x-password`.
2. `POST {BPJS_FKTL_BASE_URL}/checkinantrean` dengan `kodebooking` dan waktu saat ini.
3. Token hasil autentikasi dikirim melalui header `x-token`.

Kredensial hanya dibaca di server dan tidak dikirim ke browser kiosk.

## Secure agent dan JKN Biometrik Bot

Browser tidak mengirim kredensial Frista. Server membuat token HMAC berumur 120 detik yang berisi ID job dan hash nomor kartu. Browser mengirim token dan nomor kartu ke secure agent lokal.

Konfigurasi aplikasi server:

```dotenv
FRISTA_AGENT_URL=http://127.0.0.1:3001
FRISTA_AGENT_SHARED_SECRET=ganti-dengan-secret-minimal-32-karakter
```

Konfigurasi secure agent pada komputer Windows kiosk:

```dotenv
FRISTA_AGENT_PORT=3001
FRISTA_AGENT_SHARED_SECRET=secret-yang-sama-dengan-server
FRISTA_ALLOWED_ORIGIN=http://localhost:3886
FRISTA_BOT_URL=http://127.0.0.1:3000/?app=frista
FRISTA_USERNAME=username-frista
FRISTA_PASSWORD=password-frista
FRISTA_JOB_TIMEOUT_MS=180000
```

Secure agent memvalidasi origin, tanda tangan, masa berlaku token, dan kecocokan hash nomor kartu. Hanya satu job berbeda boleh aktif pada satu waktu. Agent menunggu respons bot; bot menunggu jendela utama Frista (`winTitle2`) selesai atau ditutup sebelum merespons.

## Bukti cetak

Bukti dicetak setelah secure agent merespons dan memuat:

- kode booking;
- nomor kartu;
- nomor rujukan;
- nomor rekam medis;
- nama dokter;
- nomor antrean.

Pencetakan menggunakan dokumen khusus ukuran 80 mm melalui iframe tersembunyi dan dialog cetak browser. Jika secure agent tidak dapat dihubungi sama sekali, bukti tidak dicetak karena proses Frista belum diketahui selesai.

## Mode bypass untuk pengujian

Admin dapat membuka Pengaturan Aplikasi dan mengaktifkan saklar **Bypass check-in FKTL ke Frista**. Pengaturan disimpan pada `app_settings.frista_bypass_enabled` dan default-nya `false`.

Saat aktif:

- nomor kartu dan kode booking tetap wajib;
- validasi FKTL tetap dijalankan;
- kegagalan validasi tidak menghentikan job Frista;
- respons gagal dari agent tidak menghentikan pencetakan bukti QR;
- kegagalan koneksi total ke agent tetap menghentikan pencetakan.

Mode ini hanya untuk pengembangan dan harus dinonaktifkan setelah pengujian.

Migrasi pengaturan:

```bash
make db-migrate-raw
```

Migration `0006_frista_bypass_setting.sql` memeriksa `information_schema` sebelum menambah kolom sehingga aman dijalankan ulang pada versi MySQL/MariaDB lama yang belum mendukung `ADD COLUMN IF NOT EXISTS`.

## QR dummy

Dua QR dengan data palsu tersedia untuk pengujian scanner dan parsing:

- `/dev/bpjs-checkin-dummy-qr.png`
- `/dev/bpjs-checkin-dummy-qr-2.png`

File sumber berada di `public/dev/`. QR dummy dapat menghasilkan status gagal pada FKTL atau Frista karena nomor kartu tidak terdaftar. Aktifkan bypass dev untuk menguji kelanjutan alur dan pencetakan.

QR dummy tidak membuktikan biometrik Frista berhasil. Pengujian biometrik penuh memerlukan nomor kartu peserta yang valid dan izin penggunaan data tersebut.

## Pemeriksaan operasional

1. Pastikan aplikasi kiosk, secure agent, JKN Biometrik Bot, dan Frista berjalan pada mesin yang sesuai.
2. Pastikan origin kiosk sama persis dengan `FRISTA_ALLOWED_ORIGIN`.
3. Pastikan shared secret server dan agent sama serta minimal 32 karakter.
4. Pastikan printer kiosk dipilih sebagai printer default bila memakai dialog cetak browser.
5. Uji mode normal setelah mode bypass berhasil, lalu nonaktifkan bypass.
