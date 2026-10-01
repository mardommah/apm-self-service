# Instalasi Frista di PC Kiosk APM

1. Ekstrak `frista-apm-windows.zip` ke `C:\apm-self-service`. Pastikan `C:\frista\frista.exe` tersedia. Pasang Node.js 20 dan Bun.
2. Di folder tersebut, salin `frista-windows.env.example` menjadi `.env`. Isi `FRISTA_AGENT_SHARED_SECRET` sama persis dengan server APM, serta `FRISTA_USERNAME` dan `FRISTA_PASSWORD` milik Frista. Set `FRISTA_ALLOWED_ORIGIN=http://192.168.1.127:3886` tanpa `/kiosk`.
3. Buka PowerShell **sebagai Administrator** pada `C:\apm-self-service`, lalu jalankan:

   ```powershell
   Set-ExecutionPolicy -Scope Process Bypass
   .\start-frista-windows.ps1
   ```

   Skrip ini memasang dependency bot bila perlu, menjalankan JKN Biometrik Bot dan secure agent, lalu membuka jendela Frista. Login dan input nomor kartu dilakukan saat job dari kiosk diterima. Jika agent lama masih berjalan, tutup dahulu sebelum menjalankan ulang agar perubahan `.env` terpakai.
4. Pada PowerShell yang sama, periksa:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:3001/health
   ```

   Pastikan `ok` bernilai `true` dan `allowedOrigin` sama dengan `http://192.168.1.127:3886`. `fristaReady` dapat bernilai `false` sebelum job pertama.
5. Untuk auto start, jalankan `.\install-frista-autostart.ps1` sebagai pengguna Windows kiosk, lalu login ulang. Skrip membuat shortcut Startup yang menjalankan bot, agent, dan membuka Frista setelah login. Jangan pasang auto start agent kedua.

Log kegagalan tersedia di `C:\frista-services\logs`. Uji dari kiosk: **Pasien BPJS → Pasien Lama → Cek Booking / Uji Frista** dengan nomor dummy 13 digit saat mode pengujian aktif.
