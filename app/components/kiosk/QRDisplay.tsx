import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { SERVICE_ICONS, formatTime } from "~/lib/utils";

interface Props {
  visitId: string;
  serviceLabel: string;
  serviceCode: string;
  appUrl: string;
  timeoutMs: number;
  onTimeout: () => void;
}

export function QRDisplay({
  visitId,
  serviceLabel,
  serviceCode,
  appUrl,
  timeoutMs,
  onTimeout,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(timeoutMs / 1000));
  const url = `${appUrl}/visit/${visitId}`;
  const icon = SERVICE_ICONS[serviceCode] ?? "🏥";

  useEffect(() => {
    if (secondsLeft <= 0) {
      onTimeout();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, onTimeout]);

  const progress = (secondsLeft / Math.floor(timeoutMs / 1000)) * 100;

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-gradient-to-b from-blue-50 to-white px-6 py-10 gap-8">
      {/* Header */}
      <div className="text-center">
        <div className="text-5xl mb-2" role="img" aria-label={serviceLabel}>
          {icon}
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{serviceLabel}</h1>
        <p className="text-gray-500 mt-1 text-lg">Scan kode QR dengan kamera HP Anda</p>
      </div>

      {/* QR Code */}
      <div className="bg-white p-6 rounded-3xl shadow-xl border-4 border-blue-100">
        <QRCode
          value={url}
          size={260}
          level="H"
          style={{ display: "block" }}
          aria-label={`QR code untuk kunjungan ${visitId}`}
        />
      </div>

      {/* Visit ID */}
      <div className="text-center bg-blue-50 rounded-xl px-8 py-4 border border-blue-100">
        <p className="text-sm text-blue-500 font-medium uppercase tracking-widest mb-1">
          No. Kunjungan
        </p>
        <p className="font-mono text-2xl font-bold text-blue-800 tracking-wider">
          {visitId}
        </p>
      </div>

      {/* Countdown */}
      <div className="w-full max-w-sm">
        <div className="flex justify-between text-sm text-gray-500 mb-2">
          <span>Halaman akan kembali otomatis</span>
          <span className={secondsLeft <= 30 ? "text-red-500 font-bold" : ""}>
            {secondsLeft}s
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center max-w-xs">
        Setelah scan, simpan atau cetak tiket dari HP Anda
      </p>
    </div>
  );
}
