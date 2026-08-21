# Plan: Aplikasi Self Service Pasien Klinik

## Overview

Aplikasi kiosk berbasis web yang berjalan di console box klinik. Pasien memilih layanan, sistem generate QR code unik, pasien scan via HP, data tersimpan ke database dengan timestamp. Ada device lock (satu device = satu registrasi aktif) dan dashboard admin.

---

## Tech Stack

| Layer | Pilihan |
|---|---|
| Runtime | Bun |
| Framework | TanStack Start (full-stack, SSR) |
| UI | shadcn/ui + Tailwind CSS |
| Database | MariaDB (via mysql2 + Drizzle ORM) |
| Auth (Admin) | Custom JWT (jsonwebtoken + bcrypt) |
| QR Code Generate | `react-qr-code` (di kiosk) |
| QR Code Scan | `html5-qrcode` atau `@zxing/browser` (di admin scan) |
| Print | APM print SDK (prioritas) + browser print fallback |
| State | TanStack Query |

---

## Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│                     KIOSK (Console Box)                      │
│   TanStack Start (browser kiosk mode)                        │
│   [Welcome] → [Pilih Layanan] → [Tampil QR Besar]           │
└────────────────────────┬────────────────────────────────────┘
                         │ QR = URL token unik
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    HP PASIEN (scan QR)                       │
│   Buka URL → Tampil: ID, Timestamp, Layanan, Opsi Print     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP request
                         ▼
┌─────────────────────────────────────────────────────────────┐
│           Server (Bun + TanStack Start API Routes)           │
│   - Generate visit record                                    │
│   - Validasi device lock (satu device = satu sesi aktif)    │
│   - Mark scanned + simpan timestamp                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    MariaDB Database                          │
│                    (Drizzle ORM)                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Admin Dashboard                            │
│   - Login → Lihat kunjungan → Filter/Search                 │
│   - Scan barcode → auto marking served                      │
│   - Revoke akses + Remove data                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema (MariaDB)

```sql
-- Layanan yang tersedia
CREATE TABLE services (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  code       VARCHAR(50) UNIQUE NOT NULL,   -- 'registrasi' | 'poli_umum' | 'igd' | 'laboratorium'
  label      VARCHAR(100) NOT NULL,         -- 'Registrasi Pasien', 'Poli Umum', dst
  icon       VARCHAR(50),                   -- icon name untuk UI
  is_active  BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Log kunjungan pasien
CREATE TABLE visits (
  id          VARCHAR(26) PRIMARY KEY,      -- ULID
  service_id  INT NOT NULL,
  device_id   VARCHAR(255) NOT NULL,        -- fingerprint device kiosk (SHA-256)
  status      ENUM('waiting','served','revoked') DEFAULT 'waiting',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  scanned_at  DATETIME NULL,               -- kapan QR di-scan di HP pasien
  scanned_ua  TEXT NULL,                   -- user-agent HP yang scan
  served_at   DATETIME NULL,               -- kapan marking served
  served_by   INT NULL,                    -- admin id yang marking
  notes       TEXT NULL,
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (served_by) REFERENCES admins(id),
  INDEX idx_device_status (device_id, status),
  INDEX idx_created_at (created_at DESC)
);

-- Admin accounts
CREATE TABLE admins (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  username     VARCHAR(100) UNIQUE NOT NULL,
  password     TEXT NOT NULL,              -- bcrypt hash
  role         ENUM('admin','security') DEFAULT 'admin',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login   DATETIME NULL
);
```

### Status Flow

```
waiting → served   (scan barcode admin ATAU manual marking)
waiting → revoked  (admin revoke)
served  → revoked  (admin revoke after served)
```

---

## Struktur Folder Proyek

```
apm-self-service/
├── app/
│   ├── routes/
│   │   ├── index.tsx                  # Welcome / kiosk home
│   │   ├── kiosk/
│   │   │   ├── index.tsx              # Pilih layanan
│   │   │   └── qr.$visitId.tsx        # QR fullscreen + countdown
│   │   ├── visit.$visitId.tsx         # Halaman HP pasien setelah scan
│   │   └── admin/
│   │       ├── login.tsx
│   │       ├── dashboard.tsx          # Tabel kunjungan + stats
│   │       ├── scan.tsx               # Scan barcode → auto marking served
│   │       └── settings.tsx
│   ├── components/
│   │   ├── kiosk/
│   │   │   ├── ServiceCard.tsx        # Kartu pilih layanan
│   │   │   └── QRDisplay.tsx          # QR besar + instruksi + countdown
│   │   ├── visit/
│   │   │   └── VisitDetail.tsx        # Detail kunjungan di HP
│   │   └── admin/
│   │       ├── VisitsTable.tsx        # Tabel + filter
│   │       ├── StatsCards.tsx         # Statistik harian
│   │       └── BarcodeScanner.tsx     # Komponen scan kamera
│   ├── server/
│   │   ├── db.ts                      # Koneksi MariaDB + Drizzle instance
│   │   ├── schema.ts                  # Drizzle table definitions
│   │   └── functions/
│   │       ├── visits.ts              # CRUD visits + device lock check
│   │       ├── services.ts            # CRUD services
│   │       └── auth.ts                # Admin login + JWT
│   └── lib/
│       ├── device.ts                  # Device fingerprint (browser)
│       ├── ulid.ts                    # ULID generator
│       └── print.ts                  # APM print + browser print fallback
├── drizzle/
│   └── migrations/
├── drizzle.config.ts
├── .env.example
├── package.json
└── bunfig.toml
```

---

## Alur Lengkap

### Kiosk (Console Box)

```
1. Layar idle → Welcome screen dengan nama klinik + jam realtime
2. Pasien tap → Pilih layanan:
   [Registrasi Pasien] [Poli Umum] [IGD] [Laboratorium]
3. Sistem cek device_id (fingerprint dari localStorage):
   - Ada kunjungan 'waiting' → tampil warning "Anda sudah melakukan registrasi"
                               + tombol "Batalkan & Buat Baru"
   - Tidak ada → lanjut
4. Server insert visit → return visit.id (ULID)
5. Kiosk render QR fullscreen:
   QR berisi → https://domain/visit/{id}
6. Instruksi scan + countdown timer 5 menit
7. Timeout → kembali ke welcome screen, status tetap 'waiting'
```

### HP Pasien (setelah scan QR)

```
1. Buka URL: /visit/{id}
2. Server update scanned_at + scanned_ua
3. Render halaman:
   ┌──────────────────────────────┐
   │  ✅ Registrasi Berhasil      │
   │  No. Antrian: KLN-0821-XXXX  │
   │  Layanan: Poli Umum          │
   │  Tanggal: 21 Agustus 2026    │
   │  Pukul: 09:42 WIB            │
   │  Status: Menunggu Dipanggil  │
   │                              │
   │  [🖨 Cetak via APM]          │
   │  [📄 Cetak via Browser]      │
   └──────────────────────────────┘
4. APM print (prioritas): kirim data ke APM printer SDK
5. Fallback: window.print() dengan template tiket thermal
```

### Admin Dashboard

```
1. Login dengan username + password → JWT disimpan di httpOnly cookie
2. Dashboard:
   - Stats cards: total hari ini, waiting, served, revoked per layanan
   - Tabel kunjungan: filter by layanan / status / tanggal
3. Per baris:
   - [Tandai Dilayani] → status = 'served', served_at, served_by
   - [Revoke]          → status = 'revoked'
   - [Hapus]           → delete record
```

### Admin Scan Barcode (Halaman /admin/scan)

```
1. Admin/security buka /admin/scan (mobile-friendly)
2. Kamera aktif dengan overlay crosshair
3. Scan QR dari layar HP pasien
4. Decode URL → extract visit.id
5. Server validasi status:
   - 'waiting' → update served + tampil konfirmasi hijau
   - 'served'  → tampil info "Sudah dilayani" + detail waktu
   - 'revoked' → tampil warning merah
6. Kamera reset otomatis → siap scan pasien berikutnya (continuous mode)
```

---

## Device Lock Logic

Fingerprint dibuat di browser kiosk dari:
- `navigator.userAgent`
- `screen.width + screen.height + screen.colorDepth`
- `navigator.hardwareConcurrency`
- `Intl.DateTimeFormat().resolvedOptions().timeZone`

Di-hash SHA-256 → disimpan di `localStorage` key `kiosk_device_id`.
Cek ke server: `SELECT id FROM visits WHERE device_id = ? AND status = 'waiting' LIMIT 1`.

---

## Fase Implementasi

| Fase | Scope | Status |
|---|---|---|
| Fase 1 | Setup project (Bun + TanStack Start + Tailwind + shadcn + Drizzle) | [ ] |
| Fase 2 | Database schema + Drizzle migrations (MariaDB) | [ ] |
| Fase 3 | Server functions: db, visits CRUD, auth JWT | [ ] |
| Fase 4 | Kiosk flow: welcome → pilih layanan → QR display + device lock | [ ] |
| Fase 5 | Halaman HP pasien: detail kunjungan + mark scanned + print | [ ] |
| Fase 6 | Admin dashboard: login, tabel, stats, manual marking, revoke, delete | [ ] |
| Fase 7 | Admin scan barcode: kamera → auto marking served | [ ] |
| Fase 8 | Print integration: APM SDK + browser print fallback | [ ] |

---

## Environment Variables (.env)

```env
DATABASE_URL=mysql://user:password@localhost:3306/klinik_selfservice
JWT_SECRET=your-super-secret-key
APP_URL=http://localhost:3000
KIOSK_TIMEOUT_MS=300000
```
