
Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

dont generate app.config.timestamp_xxxx logs
## Kiosk screens

- UI kiosk ada di `app/components/kiosk/KioskScreen.tsx`; route `/kiosk` dan `/kiosk2` hanya wrapper tipis (loader `getServicesAction`).
- `/kiosk2` (`bpjsDirectPrint`): kartu BPJS langsung `createVisit("registrasi")` tanpa pilih pasien baru/lama, cek booking, atau Frista → halaman `/kiosk/qr/$visitId?from=kiosk2` (QR + cetak struk). `poli_umum` juga langsung `createVisit` (tanpa `GeneralPatientPanel`). Layanan lain sama dengan `/kiosk`.
- `/kiosk2` offline-first (`app/lib/offline-kiosk.ts`): loader cache-first: `KioskData` dari localStorage langsung tampil, fetch di belakang memperbarui cache untuk pembukaan berikutnya. Jika `createVisit` gagal, tiket dibuat lokal (ULID + nomor `O001`, reset harian) di outbox; halaman tiket membaca outbox dulu sebelum server. `startBackgroundSync` (setiap 15 detik + event `online`) mengirim outbox via `kioskAction` `sync` (idempoten per id). Nomor offline disimpan di `visits.notes` (`offline:O001`) dan tidak ikut dihitung `getDailyQueueNumber`. Reload browser saat offline tetap gagal (tanpa Service Worker).
- `/kiosk` Pasien Umum (`GeneralPatientPanel`) meniru mLITE `anjungan/pasien`: Pasien Baru & Pasien Lama → layar Antrian Loket 1/2 (`GeneralLoketQueue`, tanpa iframe mLITE). `general-loket-queue` membuat visit app (Loket 1 → `poli_umum` mLITE Loket/A, Loket 2 → `customer_service` mLITE CS/B; `createVisit` opsi `mliteQueueType` mengabaikan prefix layanan) → tampil di pemanggil admin. Preview nomor dari SIMRS boleh gagal (tombol tetap aktif, nomor app). Hanya `patientStatus` `baru` (BPJS Pasien Baru & Umum Pasien Baru) yang dicatat ke `mlite_antrian_loket` (`createVisit`); semua tiket lain (pasien lama, CS langsung, lab, vaksinasi, kiosk2) nomor app tanpa huruf A/B, tanpa Simpan RM. BPJS Pasien Lama → pilihan Cetak Struk (visit `registrasi` + `lama`, tanpa mLITE, halaman tiket `/kiosk/qr` + cetak) atau Proses Check-in (alur booking/Frista lama).
- `visits.patient_status` (`baru`/`lama`): diisi Umum (pilihan pasien) & BPJS Pasien Baru (`create` + `patientStatus` tanpa `destinationServiceCode`, agar tidak masuk alur `BpjsCheckin`). Label `PATIENT_STATUS_LABELS` (`app/lib/utils.ts`) tampil di struk (`printTicket`, `printGeneralLoketQueue`, `printBpjsCheckin` selalu Pasien Lama), halaman tiket `QRDisplay`, dan halaman scan barcode `VisitTicket`.
- Struk seragam (`app/lib/print.ts`): semua cetak (`printTicket` fallback browser, `printGeneralLoketQueue`, `printBpjsCheckin`) lewat satu template `receiptHtml` (`Receipt`: judul, nomor besar, baris label/nilai, satu catatan) + `printReceipt` (iframe tersembunyi). Hemat kertas: `@page` 80mm margin 0, body 72mm, 11px monospace, line-height rapat. Ubah tampilan struk hanya di `RECEIPT_CSS`/`receiptHtml`. Jalur `window.APMPrinter` (template SDK) tidak ikut template ini.
- Setting `barcode_enabled` (label "Tampilkan QR scan antrian pasien"): aktif → halaman tiket `/kiosk/qr/$visitId` menampilkan QR + No. kunjungan; nonaktif → detail antrean (nomor, layanan, jenis pasien, waktu, no. kunjungan) + pratinjau struk (`iframe srcDoc` dari `receiptHtml(ticketReceipt(...))`, sama persis dengan yang dicetak), dan `/admin/scan` ditutup.
- `?from=kiosk2` membuat tombol kembali & timeout di `QRDisplay` (`homePath`) kembali ke `/kiosk2`.
- Setelah tambah/ubah file route, regenerasi `app/routeTree.gen.ts` (dev server melakukannya otomatis, atau pakai `generator` dari `@tanstack/router-generator`).
- Setting `auto_print_enabled` (default TRUE, migration `0009`) → `QRDisplay` memanggil `printTicket` sekali saat halaman tiket terbuka (guard `useRef`). Toggle "Cetak struk otomatis" di Pengaturan Aplikasi admin. Berlaku untuk semua halaman tiket `/kiosk/qr/$visitId` (kiosk 1 & 2).
- Setting `kiosk_return_seconds` (default 30, migration `0010`, validasi 5–600) → timeout kembali otomatis halaman tiket `/kiosk/qr/$visitId`. Diatur di Pengaturan Aplikasi admin; menggantikan env `KIOSK_TIMEOUT_MS`.

## Panggil antrian & display TV

- Tombol "🔊 Panggil" di `/admin/dashboard` memanggil `callVisitAction` → tabel `queue_calls` (migration `0012`, kolom `loket`, `is_recall`). Nomor loket dipilih admin ("Loket saya", localStorage `admin-loket`).
- `/display` (tanpa login, `app/components/display/`) polling `getDisplayAction({ afterId })` tiap 2 detik; panggilan baru diputar FIFO: bel Web Audio, overlay, suara 2× (`app/lib/announce.ts`: ResponsiveVoice "Indonesian Female"; key `RESPONSIVEVOICE_KEY`/`VITE_RESPONSIVEVOICE_KEY` dibaca server saat runtime lewat `getDisplayAction.responsiveVoiceKey`, bukan saat build; ResponsiveVoice yang tidak mulai dalam 4 detik/error → `speechSynthesis` suara id-ID). Selama audio terkunci (belum ada klik & tanpa flag autoplay) `DisplaySoundGate` menampilkan "SUARA NONAKTIF · KLIK LAYAR SEKALI".
- Tiket Pasien Baru `/kiosk` (BPJS & Umum; lihat bagian Kiosk) juga dibuat di SIMRS `mlite_antrian_loket` (`/kiosk2` tidak: `skipMlite`, nomor app) sesuai prefix layanan (`services.queue_prefix`, migration `0015`, diatur di Pengaturan Aplikasi admin "Prefix nomor antrean"; konstanta `app/lib/queue-prefix.ts`, default BPJS/Umum A, CS B): A → type `Loket` (`createGeneralLoketQueue(1)`), B → type `CS` (`createGeneralLoketQueue(2)`). Hanya `MLITE_SERVICE_CODES` (registrasi, poli_umum, customer_service) yang bisa diatur. mLITE menyimpan angka saja (`noantrian` = `1`); tautan `visits.notes` = `mlite:<kd>:A1`, `parseMliteNote` menampilkan `A001` (tiket, display TV, pemanggil). Ubah prefix hanya berlaku untuk tiket baru. Gagal SIMRS → tiket tetap dibuat dengan nomor app. Tabel mLITE milik SIMRS: jangan dibuat/diubah strukturnya.
- Pemanggil loket di dashboard (`LoketCaller`, kartu BPJS/Umum/CS + Laboratorium/Vaksinasi (dipanggil di loket, tidak dicatat ke mLITE, nomor app, tanpa Simpan RM); type `loket`/`cs` dari huruf nomor): Berikutnya / Lompat → (pilih tiket + insert di bawah `withNamedLock('apm_queue_call')`, satu lock untuk semua loket & tombol 🔊; panggilan mLITE setelah lock dilepas) `queue_calls` + mLITE `anjungan/loket?show=panggil_<loket|cs>&loket=L` (end_time nomor sebelumnya) + `&antrian=N&reset=L` (counter) + `anjungan/setpanggil` (status 1, loket); Panggil Ulang → hanya `setpanggil`. Kartu juga punya "✓ Layani" (tiket terakhir masih `waiting`, `serveAction`) dan "✓ Selesai dilayani" (sudah `served`, panggilan terakhir belum `finished_at`, `finishVisitAction`), sama seperti daftar kunjungan; `current.finished` dari `queue_calls.finished_at` panggilan terakhir. Simpan RM → `anjungan/simpannorm` (RM wajib 6 digit, dicek baca-balik by `kd`) lalu visit `served`. Skema: github.com/basoro/mlite `plugins/anjungan` (Site.php, Admin.php). Kode di `app/server/mlite-loket.ts`, `functions/loket-caller.ts`.
- Setting `show_bpjs_test_accounts` (default TRUE, migration `0013`) → tampil/sembunyikan panel "Akun BPJS untuk pengujian" di halaman Pengaturan (di bawah toggle-nya).
- Akun panel admin dibuat dari halaman Pengaturan Aplikasi (`AdminUsersPanel`, `createAdminAction`, khusus role `admin`; password bcrypt).
- Video kiri: setting `display_youtube_playlist` (Pengaturan Aplikasi admin) berisi satu ID playlist, atau beberapa ID video 11 karakter dipisah koma (diputar berurutan & berulang). Video mulai mute lalu unmute setelah audio diizinkan (`youtubeSource.ts`). Overlay video (judul, "SEDANG DIPUTAR", tombol audio, progress) hanya tampil saat mouse hover / fokus di area video (`group-hover` di `DisplayVideo`).
- Status loket di `/display` (`DisplayLoketList`): loket default `DISPLAY_DEFAULT_LOKETS` (`displayConfig.ts`, Loket 1 = Antrean A, Loket 2 = Antrean B) selalu tampil "TERSEDIA" sampai memanggil; loket lain muncul setelah panggilan pertama hari itu.
- Running text `/display` diawali jadwal sholat hari ini (`app/lib/prayer-times.ts`, dihitung lokal metode Kemenag: Subuh 20°, Isya 18°, Ashar Syafi'i, ihtiyat +2 menit dibulatkan ke atas; tanggal & UTC+8 dari `DISPLAY_TIMEZONE`/`DISPLAY_UTC_OFFSET`). Setting `app_settings.prayer_times` (JSON, migration `0018`, NULL = default Maros) diatur di Pengaturan (`PrayerTimesSettings`): tampil/sembunyi, preset Maros/Makassar/Gowa/Pangkep atau koordinat sendiri, nama tampil, koreksi menit per waktu (±30). Divalidasi `parsePrayerSettings`. Saat masuk waktu sholat (`usePrayerAlarm`, cek tiap 15 detik, jendela 2 menit, sekali per waktu per hari): masuk antrean yang sama dengan panggilan pasien (`useCallAnnouncer` `enqueuePrayer`, tidak saling potong) → jingle `public/sounds/prayer-announcement.mp3` (`playSound`, fallback `chime`) + splash `DisplayPrayerOverlay` + TTS `prayerAnnouncementText` (pitch 1.2, sekali) + video diredam. Tombol "🔊 Tes pengumuman di TV" (Pengaturan) → `testPrayerAnnouncementAction` → tes di memori server (`functions/display-test.ts`, hilang saat restart) → `getDisplayAction.test`; tiap `/display` yang terbuka memutar pengumuman sholat berikutnya sekali (tes sebelum halaman dibuka tidak diputar ulang). Tombol "🔊 Tes panggilan di TV" (`DisplayCallTest`, `testPatientCallAction`) lewat jalur yang sama (`kind: "call"`): contoh panggilan A001 "Tes Panggilan" ke Loket saya (id negatif), tidak ditulis ke `queue_calls`/mLITE.
- Pengaturan Aplikasi = halaman `/admin/pengaturan` (bukan modal; link navbar `AdminNavLinks isAdmin` hanya untuk role admin, server tetap `requireAdminToken(token, true)`). `/admin/dashboard` = pemanggil; daftar kunjungan, filter & Ringkasan Hari Ini di `/admin/kunjungan` (`useAdminVisits`). Kolom "Waktu" (`VisitTimeline` di `VisitsTable`): Daftar (`createdAt`) → Dipanggil (panggilan pertama) → Dilayani (`servedAt`) → Selesai (`finishedAt` panggilan terakhir), dari `getCallStates`; tiket tertaut mLITE (pasien baru BPJS/Umum) juga menampilkan `start_time` → `end_time` mLITE (`getMliteQueueTimes`, hanya baca by `kd`, `end_time` `00:00:00` = belum selesai, SIMRS gagal → "tidak terbaca"). Navigasi navbar: `AdminNavLinks`. Loket petugas: `app/lib/admin-loket.ts` (localStorage `admin-loket`).
- Nomor antrean mLITE Pasien Baru (`createGeneralLoketQueue`) selalu langsung ke DB SIMRS (`SIMRS_DB_*`, tanpa HTTP ke web mLITE): di bawah `GET_LOCK('apm_general_loket_queue')` hitung `MAX(noantrian)` hari ini per type (Loket/CS) + 1, lalu `directInsertQueue` (INSERT sama dengan mLITE `simpanloket`/`simpancs`, `kd` dari `insertId`).
- `ENV=staging` → pemanggilan & Simpan RM mLITE juga ditulis langsung (SQL meniru PHP mLITE) ke `mlite_antrian_loket`/`mlite_settings` di `SIMRS_DB_*` lewat `app/server/mlite-direct.ts`, tanpa HTTP ke `MLITE_GENERAL_PATIENT_URL` (mLITE produksi). Selain staging: endpoint HTTP mLITE.
- Realtime admin = polling (bukan WebSocket/SSE): `LoketCaller` poll `getLoketCallerAction` tiap 5 detik (dilewati saat tab tersembunyi, langsung refresh saat tab aktif lagi); `/admin/dashboard` & `/admin/kunjungan` tiap 30 detik. Toast "Antrean baru masuk" (`@radix-ui/react-toast`, di `LoketCaller`) muncul bila `newest` (tiket menunggu terbaru per layanan, dari `getLoketCallerState`) berubah; poll pertama hanya seeding, tanpa toast.
- Nomor antrean disimpan permanen di `visits.queue_number` (migration `0016`) saat `createVisit`: mLITE → `A001`/`B001` (dari note), offline → `O<perangkat>-001` (kode perangkat 1–99 dari `/kiosk2?device=N`, disimpan localStorage `kiosk2_device`, acak bila belum diset; format lama `O001` masih diterima sync), tiket app → huruf per layanan + counter harian sendiri (`insertWithAppQueueNumber`: `withNamedLock('apm_queue_<huruf>')` di `app/server/db.ts` + `SELECT MAX` + insert autocommit, lock dilepas setelah insert ter-commit; jangan pakai GET_LOCK di dalam `transaction` karena RELEASE jalan sebelum COMMIT): BPJS `registrasi` C, Umum `poli_umum` D, CS E, Lab L, Vaksinasi V, lain P; `patientStatus` `lama` → C (BPJS) / D (Umum, termasuk pilih Loket 2). A/B milik antrean mLITE (Pasien Baru BPJS/Umum): bila `createGeneralLoketQueue` gagal, tiket tetap A/B sesuai loket/prefix (counter app `lastAppQueueNumber`), dan nomor berikutnya ke mLITE serta pratinjau layar (`getGeneralLoketPreview`) = `GREATEST(MAX mLITE, terakhir A/B app) + 1` supaya tidak bentrok. Pasien Lama Umum tetap D (keputusan user), kiosk2 (`skipMlite`) tetap nomor app. `getDailyQueueNumber` memakai `queueNumber` bila ada (semua select visit wajib ikut `queueNumber: visits.queueNumber`); hitungan lama hanya untuk tiket sebelum migration. Unique key `uq_visits_queue_date_number` (`queue_date` generated `DATE(created_at)` + `queue_number`, migration `0017`, DB app saja): nomor mLITE/offline di-insert lewat `insertWithFixedQueueNumber` (tanpa `ON DUPLICATE KEY UPDATE`, karena itu akan menimpa visit lain lewat index nomor); id sama → no-op, nomor dipakai visit lain → `QUEUE_NUMBER_TAKEN` (sync offline membuang tiket itu + log). `markServed` = update bersyarat `status='waiting'`; Simpan RM cek status sebelum menulis ke mLITE (`VISIT_NOT_WAITING`).
- Dokumen PDF di `docs/pdf/` (sumber HTML A4 di folder yang sama): `pedoman-penggunaan-apm` (untuk pasien awam) dan `arsitektur-apm` (desain teknis). Render ulang setelah alur/penomoran berubah: `google-chrome-stable --headless=new --no-pdf-header-footer --print-to-pdf=<out>.pdf file://<path>.html`.
- Halaman `/admin/pasien` ("🔎 Cari Pasien", semua role): cari data pasien SIMRS (hanya baca) by awalan nama (min 3 huruf, `LIKE 'X%'`, wildcard user di-escape), tanggal lahir, dan/atau tanggal layanan (`EXISTS reg_periksa.tgl_registrasi`, stts ≠ Batal); filter yang diisi digabung AND, minimal satu; pagination 50 per halaman (`SIMRS_PATIENT_PAGE_SIZE`, `COUNT(*)` + `LIMIT/OFFSET`, urut nama lalu No. RM; halaman memakai filter `applied` terakhir, bukan isian form). Tampil No. RM, nama, tgl lahir, NIK, alamat, jumlah & kunjungan terakhir (`reg_periksa` non-Batal). Query `searchSimrsPatients` (`app/server/simrs.ts`, tanggal via `DATE_FORMAT` agar tidak geser zona waktu), action `searchSimrsPatientsAction` (`app/server/actions/patient-search.ts`). Route client hanya boleh `import type` dari `~/server/simrs` (value import membawa mysql2 ke bundle client).
- Admin responsif mobile: semua halaman admin (kecuali `/admin/scan` & login) memakai `AdminHeader` (`app/components/admin/AdminHeader.tsx`: judul + Keluar satu baris, menu `AdminNavLinks` di bawahnya geser horizontal; satu baris mulai `lg`; aksi khusus halaman lewat `children`, mis. Scan Barcode di dashboard). Jangan buat header/logout sendiri per halaman. Tabel (`VisitsTable`, tabel `/admin/pasien`) jadi kartu di bawah `md` lewat kelas `max-md:` (table/tbody `block`, `tr` grid 2 kolom, `thead` hidden; label kolom di kartu pasien via `data-label` + `before:content-[attr(data-label)]`).
