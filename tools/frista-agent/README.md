# Frista secure agent

Jalankan pada PC Windows kiosk yang juga menjalankan JKN Biometrik Bot dan `frista.exe`.

```powershell
$env:FRISTA_AGENT_SHARED_SECRET="secret-yang-sama-dengan-server-minimal-32-karakter"
$env:FRISTA_USERNAME="username-rumah-sakit"
$env:FRISTA_PASSWORD="password-rumah-sakit"
$env:FRISTA_ALLOWED_ORIGIN="http://localhost:3886"
$env:FRISTA_BOT_URL="http://127.0.0.1:3000/?app=frista"
bun run .\tools\frista-agent\index.ts
```

Agent hanya bind ke `127.0.0.1`, memvalidasi job bertanda tangan dan kedaluwarsa, menyimpan credential di environment lokal, serta membatasi satu proses Frista pada satu waktu. Agent tidak menentukan keberhasilan face recognition; aplikasi tetap meminta status final dari BPJS melalui mLITE.

Agent membuka dan login Frista hanya saat menerima job agar bot selalu memulai dari state GUI yang didukung. Waktu tunggu login bot dibuat 1000 ms untuk mengurangi jeda. Endpoint `/health` menampilkan hasil job terakhir melalui `fristaReady` dan `lastLoginError`.
