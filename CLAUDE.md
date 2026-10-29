
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
- `/kiosk2` offline-first (`app/lib/offline-kiosk.ts`): loader menyimpan `KioskData` ke localStorage dan memakai cache saat server tidak terjangkau. Jika `createVisit` gagal, tiket dibuat lokal (ULID + nomor `O001`, reset harian) di outbox; halaman tiket membacanya dari outbox. `startBackgroundSync` (setiap 15 detik + event `online`) mengirim outbox via `kioskAction` `sync` (idempoten per id). Nomor offline disimpan di `visits.notes` (`offline:O001`) dan tidak ikut dihitung `getDailyQueueNumber`. Reload browser saat offline tetap gagal (tanpa Service Worker).
- `?from=kiosk2` membuat tombol kembali & timeout di `QRDisplay` (`homePath`) kembali ke `/kiosk2`.
- Setelah tambah/ubah file route, regenerasi `app/routeTree.gen.ts` (dev server melakukannya otomatis, atau pakai `generator` dari `@tanstack/router-generator`).
- Setting `auto_print_enabled` (default TRUE, migration `0009`) → `QRDisplay` memanggil `printTicket` sekali saat halaman tiket terbuka (guard `useRef`). Toggle "Cetak struk otomatis" di Pengaturan Aplikasi admin. Berlaku untuk semua halaman tiket `/kiosk/qr/$visitId` (kiosk 1 & 2).
- Setting `kiosk_return_seconds` (default 30, migration `0010`, validasi 5–600) → timeout kembali otomatis halaman tiket `/kiosk/qr/$visitId`. Diatur di Pengaturan Aplikasi admin; menggantikan env `KIOSK_TIMEOUT_MS`.
