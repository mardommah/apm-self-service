import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  component: WelcomePage,
});

function WelcomePage() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeStr = time.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = time.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="kiosk-fullscreen flex flex-col items-center justify-between bg-gradient-to-br from-blue-700 via-blue-600 to-blue-800 text-white px-8 py-12">
      {/* Top: Clock */}
      <div className="text-center">
        <div className="text-7xl font-bold font-mono tracking-widest tabular-nums">
          {timeStr}
        </div>
        <div className="text-xl mt-2 text-blue-200 capitalize">{dateStr}</div>
      </div>

      {/* Center: Welcome */}
      <div className="text-center flex flex-col items-center gap-6">
        <div className="text-8xl" role="img" aria-label="Klinik">
          🏥
        </div>
        <h1 className="text-5xl font-bold">Selamat Datang</h1>
        <p className="text-2xl text-blue-200 max-w-md text-center leading-relaxed">
          Silakan tap tombol di bawah untuk memulai registrasi
        </p>

        <Link
          to="/kiosk"
          className="mt-4 inline-flex items-center justify-center gap-3 bg-white text-blue-700 font-bold text-2xl px-16 py-6 rounded-2xl shadow-2xl hover:bg-blue-50 active:scale-95 transition-all"
          aria-label="Mulai registrasi"
        >
          Mulai Sekarang →
        </Link>
      </div>

      {/* Bottom: footer */}
      <div className="text-blue-300 text-sm text-center">
        <p>Sentuh layar untuk memulai • Bantuan: Hubungi Petugas</p>
      </div>
    </div>
  );
}
