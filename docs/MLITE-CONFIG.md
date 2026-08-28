# Konfigurasi mLITE - APM Self Service

Dokumen ini berisi detail konfigurasi integrasi antara `apm-self-service` dengan sistem mLITE (Sistem Informasi Klinik Open Source).

---

## ⚠️ PRINSIP UTAMA

> **mLITE TIDAK BOLEH DIUBAH SAMA SEKALI**
>
> APM Self Service harus menyesuaikan dengan kondisi existing mLITE production.
> Tidak ada penambahan endpoint, modifikasi kode, atau perubahan konfigurasi di sisi mLITE.

---

## 1. Ringkasan Integrasi

`apm-self-service` berkomunikasi dengan mLITE menggunakan **endpoint existing** yang sudah tersedia di production.

**Arsitektur:** Kiosk → APM Self Service → mLITE (Existing Endpoints) → BPJS VClaim

---

## 2. Konfigurasi mLITE Production

### 2.1. File `config.php` Production

```php
<?php
// Database
define('DBHOST', 'localhost');
define('DBPORT', '3306');
define('DBUSER', 'example_user');
define('DBPASS', 'example_password');
define('DBNAME', 'klinik_example');

// URL Webapps
define('WEBAPPS_URL', 'http://mlite.example.com:81/klinik_example/webapps');
define('WEBAPPS_PATH', BASE_DIR . '/webapps');

// Admin cat name
define('ADMIN', 'admin');

// Multi APP
define('MULTI_APP', false);

// Themes path
define('THEMES', BASE_DIR . '/themes');

// Modules path
define('MODULES', BASE_DIR . '/plugins');

// Uploads path
define('UPLOADS', BASE_DIR . '/uploads');

// Lock files
define('FILE_LOCK', false);

// Basic modules
define('BASIC_MODULES', serialize([
    9 => 'settings',
    0 => 'dashboard',
    1 => 'master',
    2 => 'pasien',
    3 => 'rawat_jalan',
    4 => 'kasir_rawat_jalan',
    5 => 'kepegawaian',
    6 => 'farmasi',
    8 => 'users',
    7 => 'modules',
   10 => 'wagateway'
]));

// Developer mode
define('DEV_MODE', false);
?>
```

### 2.2. Informasi Server Production

| Item | Nilai |
|------|-------|
| **IP Server** | `mlite.example.com` |
| **Port** | `81` |
| **Path mLITE** | `/klinik_example` |
| **URL Base** | `http://mlite.example.com:81/klinik_example` |
| **Database** | `klinik_example` |
| **PHP Version** | Minimal 5.5 |

---

## 3. Endpoint Existing mLITE yang Digunakan

Berdasarkan analisis `plugins/anjungan/Site.php`, berikut endpoint yang **sudah tersedia** dan dapat digunakan:

### 3.1. Identifikasi & Pendaftaran Pasien

| Endpoint | Method | Fungsi | Parameter |
|----------|--------|--------|-----------|
| `/anjungan/daftar/{nik}` | GET | Cari/daftar pasien by NIK | `nik`: 16 digit NIK |

**Response:** Redirect ke `/anjungan/sep/{no_peserta}/{no_rkm_medis}`

**Alur:**
1. Cari pasien di database lokal by `no_ktp` (NIK)
2. Jika tidak ada, panggil BPJS VClaim `Peserta/nik/{nik}/tglSEP/{tgl}`
3. Buat pasien baru di database mLITE
4. Redirect ke halaman SEP

### 3.2. Cek Status & Rujukan

| Endpoint | Method | Fungsi | Parameter |
|----------|--------|--------|-----------|
| `/anjungan/sep/{no_kartu}/{no_rkm_medis}` | GET | Cek rujukan & status biometrik | `no_kartu`: 13 digit, `no_rkm_medis`: No. RM |

**Response:** HTML dengan data rujukan dan status biometrik

**Alur:**
1. Panggil BPJS VClaim `Rujukan/List/Peserta/{no_kartu}`
2. Jika tidak ada, coba `Rujukan/RS/List/Peserta/{no_kartu}`
3. Cek status fingerprint `SEP/FingerPrint/Peserta/{no_kartu}/TglPelayanan/{tgl}`
4. Tampilkan form SEP

### 3.3. Check-in Booking

| Endpoint | Method | Fungsi | Parameter |
|----------|--------|--------|-----------|
| `/anjungan/checkin/{referensi}` | GET | Check-in dari booking | `referensi`: Kode booking |

**Response:** Redirect ke halaman SEP atau error

**Alur:**
1. Cari `mlite_antrian_referensi` by `nomor_referensi`
2. Cari `booking_registrasi` by `no_rkm_medis` dan tanggal hari ini
3. Validasi status booking (harus `Belum`)
4. Insert ke `reg_periksa`
5. Update status booking jadi `Terdaftar`
6. Redirect ke `/anjungan/sep/{no_peserta}/{no_rkm_medis}`

### 3.4. Buat SEP

| Endpoint | Method | Fungsi | Parameter |
|----------|--------|--------|-----------|
| `/anjungan/sep/bikin/{no_rujukan}/{no_rkm_medis}/{kd_poli_bpjs}` | GET | Form buat SEP | `no_rujukan`: Nomor rujukan, `no_rkm_medis`: No. RM, `kd_poli_bpjs`: Kode poli BPJS |

**Response:** HTML form SEP

**Alur:**
1. Ambil detail rujukan dari BPJS
2. Cek apakah sudah ada `reg_periksa` hari ini
3. Jika belum, buat `reg_periksa` baru
4. Cari/buat surat kontrol
5. Tampilkan form SEP

### 3.5. Simpan SEP

| Endpoint | Method | Fungsi |
|----------|--------|--------|
| `/anjungan/sep/savesep` | POST | Simpan SEP ke BPJS |

**Request:** Form data dengan field SEP lengkap

**Alur:**
1. Kirim data SEP ke BPJS VClaim `SEP/2.0/insert`
2. Simpan hasil ke `bridging_sep`
3. Kirim antrean ke Mobile JKN (jika enabled)
4. Redirect ke cetak SEP

---

## 4. Strategi Integrasi APM Self Service

Karena mLITE tidak boleh diubah, APM Self Service harus:

### 4.1. Menggunakan Endpoint Existing

| Kebutuhan APM | Endpoint mLITE yang Digunakan |
|---------------|-------------------------------|
| Identifikasi pasien | `GET /anjungan/daftar/{nik}` |
| Cek rujukan & biometrik | `GET /anjungan/sep/{no_kartu}/{no_rkm_medis}` |
| Check-in booking | `GET /anjungan/checkin/{referensi}` |
| Buat SEP | `GET /anjungan/sep/bikin/{no_rujukan}/{no_rkm_medis}/{kd_poli}` |
| Simpan SEP | `POST /anjungan/sep/savesep` |

### 4.2. Parsing Response HTML

Karena endpoint existing mengembalikan **HTML**, APM perlu:

1. **Scraping HTML** untuk mendapatkan data
2. **Extract redirect URL** untuk mendapatkan parameter
3. **Handle session/cookie** jika diperlukan

### 4.3. Contoh Implementasi

```typescript
// Identifikasi pasien by NIK
async function identifyPatient(nik: string) {
  const response = await fetch(
    `${MLITE_BASE_URL}/anjungan/daftar/${nik}`,
    { redirect: 'manual' } // Jangan follow redirect
  );
  
  // Ambil URL redirect
  const redirectUrl = response.headers.get('Location');
  // Extract: /anjungan/sep/{no_peserta}/{no_rkm_medis}
  
  return parseRedirectUrl(redirectUrl);
}

// Cek status biometrik
async function checkBiometricStatus(noKartu: string, noRm: string) {
  const response = await fetch(
    `${MLITE_BASE_URL}/anjungan/sep/${noKartu}/${noRm}`
  );
  const html = await response.text();
  
  // Parse HTML untuk cek status biometrik
  // Cari indikator "biometrik" atau "fingerprint"
  return parseBiometricStatus(html);
}
```

---

## 5. Variabel Environment APM Self Service

### 5.1. Variabel Wajib

```bash
# ─── mLITE BPJS bridge ───────────────────────────────────────────────────────
MLITE_BASE_URL=http://mlite.example.com:81/klinik_example
MLITE_REQUEST_TIMEOUT_MS=15000

# Tidak ada MLITE_API_TOKEN karena menggunakan endpoint existing
# Autentikasi mengandalkan IP-based access mLITE
```

### 5.2. Keamanan

- ⚠️ APM Self Service harus berada di **jaringan yang sama** dengan mLITE
- ⚠️ mLITE menggunakan IP-based access (localhost/private network)
- ⚠️ Tidak ada token API — keamanan bergantung pada network segmentation

---

## 6. Alur Integrasi yang Direkomendasikan

### 6.1. Flow Pasien Lama (Sudah Ada di mLITE)

```
1. Pasien input NIK di APM
   ↓
2. APM → GET /anjungan/daftar/{nik}
   ↓
3. mLITE cari pasien, redirect ke /anjungan/sep/{no_kartu}/{no_rm}
   ↓
4. APM parse redirect URL, dapat no_kartu & no_rm
   ↓
5. APM → GET /anjungan/sep/{no_kartu}/{no_rm}
   ↓
6. mLITE cek rujukan & status biometrik ke BPJS
   ↓
7. Jika perlu biometrik → APM trigger Frista
   ↓
8. Jika tidak perlu/lolos biometrik → APM → GET /anjungan/sep/bikin/...
   ↓
9. mLITE buat reg_periksa & tampilkan form SEP
   ↓
10. APM → POST /anjungan/sep/savesep
    ↓
11. mLITE simpan SEP ke BPJS & database
    ↓
12. APM tampilkan hasil & cetak
```

### 6.2. Flow Pasien Baru

```
1. Pasien input NIK di APM
   ↓
2. APM → GET /anjungan/daftar/{nik}
   ↓
3. mLITE panggil BPJS VClaim, buat pasien baru
   ↓
4. Lanjut ke flow pasien lama (step 4)
```

---

## 7. Integrasi Frista (Biometrik)

### 7.1. Arsitektur

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Kiosk     │────→│  APM Self Service │────→│   mLITE     │
│  (Browser)  │     │   (Node.js/Bun)   │     │   (PHP)     │
└─────────────┘     └──────────────────┘     └─────────────┘
       │                                               ↑
       │         GET /anjungan/sep/{noka}/{norm}       │
       │         (cek status biometrik di HTML)        │
       │                                               │
       ↓                                               │
┌─────────────┐     ┌──────────────────┐              │
│   Frista    │←────│  Frista Secure   │──────────────┘
│    (exe)    │     │  Agent (Bun)     │
└─────────────┘     └──────────────────┘
```

### 7.2. Konfigurasi Frista Agent

```bash
# .env APM Self Service
FRISTA_AGENT_URL=http://127.0.0.1:3001
FRISTA_AGENT_SHARED_SECRET=secret-minimal-32-karakter
```

### 7.3. Deteksi Kebutuhan Biometrik

APM perlu parse HTML response dari `/anjungan/sep/{noka}/{norm}` untuk mendeteksi:

```html
<!-- Indikator biometrik di HTML mLITE -->
<div class="alert alert-warning">
  Peserta belum melakukan validasi finger print
</div>
<button id="btn-frista">Fingerprint</button>
```

### 7.4. Instalasi Frista pada PC Kiosk

mLITE sudah memiliki integrasi Frista existing. Halaman SEP mandiri memanggil JKN
Biometrik Bot melalui `POST http://localhost:3000/?app=frista`. Karena memakai
`localhost`, bot wajib berjalan pada PC Windows yang membuka halaman mLITE di
browser kiosk, bukan pada server APM atau server mLITE.

1. Unduh `jkn-biometrik-bot.zip` dari
   `https://basoro.id/downloads/jkn-biometrik-bot.zip`.
2. Ekstrak paket pada PC kiosk.
3. Tinjau lalu jalankan `install.ps1` melalui PowerShell sesuai petunjuk paket.
4. Jalankan bot dari direktori hasil ekstrak:

```powershell
node .\index.js
```

5. Pastikan `http://localhost:3000` dapat dibuka dari browser kiosk.

### 7.5. Kredensial Frista mLITE

Isi kredensial resmi fasilitas kesehatan pada database mLITE. Jangan menyimpan
kredensial di source code, dokumentasi, atau mengirimkannya melalui chat.

```sql
INSERT INTO mlite_settings (module, field, value)
VALUES
  ('settings', 'username_frista', 'USERNAME_ANDA'),
  ('settings', 'password_frista', 'PASSWORD_ANDA')
ON DUPLICATE KEY UPDATE value = VALUES(value);
```

mLITE membaca nilai tersebut pada
`plugins/anjungan/view/sep.mandiri.noka.norm.html`, lalu mengirimkan username,
password, dan nomor kartu peserta ke bot lokal.

### 7.6. Alur Frista Existing

```text
APM menerima nomor booking
  -> mLITE /anjungan/checkin/{nomor_booking}
  -> check-in berhasil
  -> mLITE redirect ke /anjungan/sep/{no_kartu}/{no_rm}
  -> mLITE memeriksa status biometrik BPJS
  -> modal biometrik muncul jika validasi diwajibkan
  -> pengguna menekan FRISTA
  -> browser memanggil bot pada localhost:3000
```

Frista tidak selalu muncul. Modal hanya ditampilkan ketika BPJS mengembalikan
status `Peserta belum melakukan validasi finger print`. Integrasi existing belum
menjalankan Frista otomatis; pengguna tetap menekan tombol **FRISTA**.

### 7.7. Menjalankan Bot Otomatis

Gunakan Windows Task Scheduler agar bot aktif saat PC kiosk menyala:

- Trigger: `At startup` atau `At log on`.
- Program: path lengkap `node.exe`.
- Arguments: `index.js`.
- Start in: direktori JKN Biometrik Bot.

Setelah konfigurasi, uji alur memakai booking pengujian yang sah. Pastikan bot
tidak dijalankan pada lebih dari satu proses dan port `3000` tidak dipakai
aplikasi lain.

---

## 8. State Machine Workflow BPJS (Adapted)

```
CREATED → PATIENT_IDENTIFIED → BIOMETRIC_CHECK → BIOMETRIC_REQUIRED → FRISTA_RUNNING → BIOMETRIC_VERIFIED → SEP_FORM → SEP_CREATED → COMPLETED
```

State disimpan di database APM Self Service, bukan di mLITE.

---

## 9. Checklist Setup Production

### 9.1. Prasyarat mLITE (Tidak Diubah)

- [x] mLITE terinstall di `http://mlite.example.com:81/klinik_example`
- [x] Plugin `anjungan` aktif
- [x] Plugin `vclaim` aktif dan terkonfigurasi BPJS
- [x] Mapping poli BPJS sudah diisi
- [x] Mapping dokter DPJP sudah diisi

### 9.2. Setup APM Self Service

- [ ] Set `MLITE_BASE_URL=http://mlite.example.com:81/klinik_example`
- [ ] Pastikan APM server satu jaringan dengan mLITE
- [ ] Test koneksi: `curl http://mlite.example.com:81/klinik_example/anjungan`
- [ ] Implementasi parser HTML untuk response mLITE
- [ ] Setup Frista Agent (jika perlu biometrik)

---

## 10. Troubleshooting

### 10.1. mLITE tidak merespons

```bash
# Test koneksi dari server APM
curl -v http://mlite.example.com:81/klinik_example/anjungan

# Cek apakah IP APM diizinkan (harus private network)
```

### 10.2. Parsing HTML gagal

- Cek struktur HTML mLITE tidak berubah
- Gunakan selector yang robust
- Handle redirect dengan benar

### 10.3. Session/Cookie

- mLITE mungkin menggunakan session
- APM perlu handle cookie jika diperlukan
- Gunakan `fetch` dengan `credentials: 'include'`

---

## 11. Referensi

- [Dokumentasi mLITE](https://github.com/basoro/mlite)
- [BPJS VClaim API](https://dvlp.bpjs-kesehatan.go.id:8888/trust-mark/main.html#/home)
- `plan antrian BPJS.md` — Arsitektur lengkap integrasi
- `plugins/anjungan/ANALISIS_FITUR.md` — Analisis fitur anjungan mLITE

---

## 12. Catatan Penting

1. **mLITE TIDAK DIUBAH** — Semua penyesuaian di sisi APM Self Service
2. **Endpoint existing** — Gunakan `/anjungan/*` yang sudah tersedia
3. **Response HTML** — Perlu parsing, bukan JSON API
4. **IP-based access** — Keamanan bergantung pada network segmentation
5. **State management** — Disimpan di APM Self Service, bukan mLITE
