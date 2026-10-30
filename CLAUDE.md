
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
- `?from=kiosk2` membuat tombol kembali & timeout di `QRDisplay` (`homePath`) kembali ke `/kiosk2`.
- Setelah tambah/ubah file route, regenerasi `app/routeTree.gen.ts` (dev server melakukannya otomatis, atau pakai `generator` dari `@tanstack/router-generator`).
- Setting `auto_print_enabled` (default TRUE, migration `0009`) → `QRDisplay` memanggil `printTicket` sekali saat halaman tiket terbuka (guard `useRef`). Toggle "Cetak struk otomatis" di Pengaturan Aplikasi admin. Berlaku untuk semua halaman tiket `/kiosk/qr/$visitId` (kiosk 1 & 2).
- Setting `kiosk_return_seconds` (default 30, migration `0010`, validasi 5–600) → timeout kembali otomatis halaman tiket `/kiosk/qr/$visitId`. Diatur di Pengaturan Aplikasi admin; menggantikan env `KIOSK_TIMEOUT_MS`.

## Panggil antrian & display TV

- Tombol "🔊 Panggil" di `/admin/dashboard` memanggil `callVisitAction` → tabel `queue_calls` (migration `0012`, kolom `loket`, `is_recall`). Nomor loket dipilih admin ("Loket saya", localStorage `admin-loket`).
- `/display` (tanpa login, `app/components/display/`) polling `getDisplayAction({ afterId })` tiap 2 detik; panggilan baru diputar FIFO: bel Web Audio, overlay, suara 2× (`app/lib/announce.ts`: ResponsiveVoice "Indonesian Female", key `VITE_RESPONSIVEVOICE_KEY`, fallback `speechSynthesis`).
- Tiket online `/kiosk` juga dibuat di SIMRS `mlite_antrian_loket` (`/kiosk2` tidak: `skipMlite`, nomor app) mengikuti tombol anjungan mLITE (`MLITE_QUEUE_BY_SERVICE`): Pasien BPJS (`registrasi`) & Pasien Umum (`poli_umum`) → type `Loket` (A, `createGeneralLoketQueue(1)`), Customer Service (`customer_service`) → type `CS` (B, `createGeneralLoketQueue(2)`); tautan di `visits.notes` = `mlite:<kd>:A7` (`parseMliteNote`). Gagal SIMRS → tiket tetap dibuat dengan nomor app. Tabel mLITE milik SIMRS: jangan dibuat/diubah strukturnya.
- Pemanggil loket di dashboard (`LoketCaller`, kartu BPJS/Umum/CS + Laboratorium/Vaksinasi (dipanggil di loket, tidak dicatat ke mLITE, nomor app, tanpa Simpan RM); type `loket`/`cs` dari huruf nomor): Berikutnya / Lompat → `queue_calls` + mLITE `anjungan/loket?show=panggil_<loket|cs>&loket=L` (end_time nomor sebelumnya) + `&antrian=N&reset=L` (counter) + `anjungan/setpanggil` (status 1, loket); Panggil Ulang → hanya `setpanggil`. Simpan RM → `anjungan/simpannorm` (RM wajib 6 digit, dicek baca-balik by `kd`) lalu visit `served`. Skema: github.com/basoro/mlite `plugins/anjungan` (Site.php, Admin.php). Kode di `app/server/mlite-loket.ts`, `functions/loket-caller.ts`.
- Setting `show_bpjs_test_accounts` (default TRUE, migration `0013`) → tampil/sembunyikan panel "Akun BPJS untuk pengujian" di modal Pengaturan (di bawah toggle-nya).
- Akun panel admin dibuat dari modal Pengaturan Aplikasi (`AdminUsersPanel`, `createAdminAction`, khusus role `admin`; password bcrypt).
- Video kiri: setting `display_youtube_playlist` (Pengaturan Aplikasi admin) berisi satu ID playlist, atau beberapa ID video 11 karakter dipisah koma (diputar berurutan & berulang). Video mulai mute lalu unmute setelah audio diizinkan (`youtubeSource.ts`).
- `/admin/dashboard` = pemanggil + pengaturan; daftar kunjungan, filter & Ringkasan Hari Ini di `/admin/kunjungan` (`useAdminVisits`). Navigasi navbar: `AdminNavLinks`. Loket petugas: `app/lib/admin-loket.ts` (localStorage `admin-loket`).
- `ENV=staging` → antrian mLITE ditulis langsung (SQL meniru PHP mLITE) ke `mlite_antrian_loket`/`mlite_settings` di `SIMRS_DB_*` lewat `app/server/mlite-direct.ts`, tanpa HTTP ke `MLITE_GENERAL_PATIENT_URL` (mLITE produksi). Selain staging: endpoint HTTP mLITE.
