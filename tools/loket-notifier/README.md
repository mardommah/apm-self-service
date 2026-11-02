# Loket notifier (notifikasi Windows antrean baru)

Program kecil untuk PC petugas: tiap 5 detik membaca `GET /api/loket-newest` di server APM dan menampilkan
toast Windows "🔔 Antrean baru masuk" (dengan bunyi) bila ada tiket baru di layanan mana pun
(BPJS, Umum, CS, Laboratorium, Vaksinasi). Tetap jalan walau browser tertutup. Endpoint hanya
mengembalikan label layanan, jumlah menunggu, dan nomor antrean terbaru (tanpa data pasien).

## Server

Isi `NOTIFIER_KEY` di `.env` server (minimal 32 karakter, mis. `openssl rand -hex 24`), lalu restart.
Kosong = endpoint mati (503).

## Build (di mesin mana pun yang ada Bun)

```sh
bun run notifier:build   # hasil: dist/loket-notifier/loket-notifier.exe + start-notifier.cmd
```

## Pasang di PC Windows petugas

1. Salin folder `dist/loket-notifier` ke PC, mis. `C:\loket-notifier`.
2. Edit `start-notifier.cmd`: isi `NOTIFIER_SERVER` (alamat server APM) dan `NOTIFIER_KEY` (sama dengan server).
3. Klik dua kali `start-notifier.cmd` untuk tes; jendela kecil (minimize) menampilkan log.
4. Auto start: `Win+R` → `shell:startup` → taruh shortcut `start-notifier.cmd` di folder itu.

Toast tampil atas nama "Windows PowerShell". Bila tidak muncul: Settings → System → Notifications →
pastikan notifikasi aktif dan Windows PowerShell tidak dimatikan, serta Focus Assist / Do Not Disturb mati.
Opsional: `NOTIFIER_INTERVAL_MS` (default 5000).
