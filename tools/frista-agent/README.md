# Frista secure agent

Jalankan pada PC Windows kiosk yang juga menjalankan JKN Biometrik Bot dan `frista.exe`.

```powershell
$env:FRISTA_AGENT_SHARED_SECRET="secret-yang-sama-dengan-server-minimal-32-karakter"
$env:FRISTA_USERNAME="username-rumah-sakit"
$env:FRISTA_PASSWORD="password-rumah-sakit"
$env:FRISTA_ALLOWED_ORIGIN="http://192.168.1.127:3886"
$env:FRISTA_BOT_URL="http://127.0.0.1:3000/?app=frista"
bun run .\tools\frista-agent\index.ts
```

`FRISTA_ALLOWED_ORIGIN` harus sama persis dengan origin di address bar browser kiosk (protokol, host, dan port). Jika browser membuka alamat berbeda dari `APP_URL`, gunakan alamat browser tersebut.

Untuk auto start, jalankan `start-agent.ps1` dari Windows Task Scheduler dengan trigger **At log on** pada sesi pengguna yang menjalankan Frista. Contoh action: program `powershell.exe`, argumen `-NoProfile -File "C:\apm-self-service\tools\frista-agent\start-agent.ps1"`. Sesuaikan path instalasi. Skrip ini menetapkan `FRISTA_ALLOWED_ORIGIN` sebelum menjalankan agent; secret dan kredensial Frista tetap harus tersedia di environment PC itu. Jangan buat proses agent kedua jika agent sudah memiliki task startup sendiri; arahkan task yang ada ke skrip ini atau tambahkan baris pengaturan origin pada task tersebut.

Jika memakai paket `frista-apm-windows.zip`, ikuti `FRISTA-WINDOWS-README.md` dan jalankan `install-frista-autostart.ps1` sebagai gantinya; paket tersebut sudah menyalakan bot dan agent bersama.

Agent hanya bind ke `127.0.0.1`, memvalidasi job bertanda tangan dan kedaluwarsa, menyimpan credential di environment lokal, serta membatasi satu proses Frista pada satu waktu. Agent tidak menentukan keberhasilan face recognition; aplikasi tetap meminta status final dari BPJS melalui mLITE.

Agent membuka dan login Frista hanya saat menerima job agar bot selalu memulai dari state GUI yang didukung. Waktu tunggu login bot dibuat 1000 ms untuk mengurangi jeda. Endpoint `/health` menampilkan hasil job terakhir melalui `fristaReady` dan `lastLoginError`.
`/health` juga menampilkan `allowedOrigin`; nilainya harus sama dengan origin di address bar browser kiosk. Membuka `/health` langsung tidak menguji izin origin untuk request dari halaman kiosk.
