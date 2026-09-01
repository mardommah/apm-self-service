import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { SERVICE_ICONS } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { printTicket } from "~/lib/print";
import { QrCountdown } from "./QrCountdown";

interface Props {
  visitId: string;
  serviceLabel: string;
  serviceCode: string;
  createdAt: Date | string;
  status: string;
  appUrl: string;
  barcodeEnabled: boolean;
  timeoutMs: number;
  onTimeout: () => void;
}

export function QRDisplay({
  visitId,
  serviceLabel,
  serviceCode,
  createdAt,
  status,
  appUrl,
  barcodeEnabled,
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

  async function handlePrint() {
    await printTicket({
      visitId,
      serviceLabel,
      createdAt,
      status,
      appUrl: url,
      barcodeEnabled,
    });
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-gradient-to-b from-blue-50 to-white px-6 py-10 gap-8">
      {/* Header */}
      <div className="text-center">
        <div className="text-5xl mb-2" role="img" aria-label={serviceLabel}>
          {icon}
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{serviceLabel}</h1>
        <p className="text-gray-500 mt-1 text-lg">
          {barcodeEnabled ? "Scan kode QR dengan kamera HP Anda" : "Cetak dan simpan karcis antrean Anda"}
        </p>
      </div>

      {/* QR Code */}
      {barcodeEnabled && (
        <div className="bg-white p-6 rounded-3xl shadow-xl border-4 border-blue-100">
          <QRCode
            value={url}
            size={260}
            level="H"
            style={{ display: "block" }}
            aria-label={`QR code untuk kunjungan ${visitId}`}
          />
        </div>
      )}

      {/* Visit ID */}
      <div className="text-center bg-blue-50 rounded-xl px-8 py-4 border border-blue-100">
        <p className="text-sm text-blue-500 font-medium uppercase tracking-widest mb-1">
          No. Kunjungan
        </p>
        <p className="font-mono text-2xl font-bold text-blue-800 tracking-wider">
          {visitId}
        </p>
      </div>

      <QrCountdown secondsLeft={secondsLeft} timeoutMs={timeoutMs} />

      <div className="grid w-full max-w-sm gap-3 no-print">
        <Button size="lg" onClick={handlePrint} className="w-full">
          🖨️ Cetak via Printer
        </Button>
        <Button asChild variant="secondary" size="lg" className="w-full">
          <a href="/">&larr; Kembali ke Home</a>
        </Button>
      </div>

      <p className="text-xs text-gray-400 text-center max-w-xs">
        {barcodeEnabled
          ? "Setelah scan, simpan atau cetak tiket dari HP Anda"
          : "Simpan karcis dan tunjukkan kepada petugas saat dipanggil"}
      </p>
    </div>
  );
}
