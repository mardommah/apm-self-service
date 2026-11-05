# APM Self-Service (Klinik Syamsinar Maros)

## Aturan dasar
- Bun, bukan Node: `bun <file>`, `bun test`, `bun install`, `bun run <script>`, `bunx`; `.env` dimuat otomatis (tanpa dotenv). Docs Bun: `node_modules/bun-types/docs/**.mdx`.
- Jangan buat log `app.config.timestamp_xxxx`.
- Setelah tambah/ubah file route, regenerasi `app/routeTree.gen.ts` (dev server otomatis, atau `generator` dari `@tanstack/router-generator`).
- Route client hanya boleh `import type` dari `~/server/simrs` dan modul server lain yang memakai mysql2.
- Tabel mLITE/SIMRS milik SIMRS: jangan dibuat/diubah strukturnya. Tulis mLITE langsung ke DB SIMRS (`app/server/mlite-direct.ts`), bukan HTTP mLITE.
- Jangan pakai `GET_LOCK` di dalam `transaction` (RELEASE jalan sebelum COMMIT); pakai `withNamedLock` + insert autocommit.
- Semua select visit wajib ikut `queueNumber: visits.queueNumber`.
- Halaman admin wajib pakai `AdminHeader` (jangan header/logout sendiri).
- Teks display TV pakai `text-bp-ink`, jangan `text-bp-muted`/`text-bp-faint`.
- Setelah fitur/bugfix: catat konvensi baru di file `docs/dev/` yang sesuai (bukan di sini), CLAUDE.md tetap ≤ 30 baris.

## Catatan detail (baca sebelum mengubah area terkait)
- `docs/dev/kiosk.md`: `/kiosk` & `/kiosk2`, offline-first, Pasien Baru/Lama, struk `receiptHtml`, halaman tiket & setting-nya, launcher PC kiosk/TV, layar sentuh.
- `docs/dev/antrean-mlite.md`: format & penomoran `visits.queue_number` (huruf per layanan, A/B mLITE, offline), pemanggil loket `LoketCaller`, penulisan mLITE langsung ke DB SIMRS.
- `docs/dev/display.md`: `/display` (panggilan, suara, video YouTube, jadwal sholat, tes TV), `/display-kamar` (jadwal dokter `mergeJadwal`, kamar), `/display-poli` (`antripoli`, `poli_calls`).
- `docs/dev/admin.md`: `/admin/pengaturan`, akun admin, `/admin/kunjungan` timeline, polling & notifikasi (toast, Windows, `tools/loket-notifier`), `/admin/pasien`, admin mobile, dokumen PDF `docs/pdf/`.
- Lainnya: `docs/INSTALASI-KIOSK.md`, `docs/MLITE-CONFIG.md`, `docs/BPJS-FRISTA-CHECKIN.md`.
