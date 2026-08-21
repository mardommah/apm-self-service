import { useEffect, useRef, useState } from "react";

export type ScanResult =
  | { status: "success"; visitId: string; message: string; serviceLabel: string; servedAt: string }
  | { status: "already_served"; visitId: string; message: string; servedAt: string }
  | { status: "revoked"; visitId: string; message: string }
  | { status: "not_found"; message: string }
  | { status: "error"; message: string };

interface Props {
  onScan: (visitId: string) => Promise<ScanResult>;
}

export function BarcodeScanner({ onScan }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string>("");
  const processingRef = useRef(false);

  useEffect(() => {
    startScanner();
    return () => stopScanner();
  }, []);

  async function startScanner() {
    try {
      const { Html5QrcodeScanner } = await import("html5-qrcode");
      if (!containerRef.current) return;

      const scanner = new Html5QrcodeScanner(
        "qr-scanner-container",
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          rememberLastUsedCamera: true,
        },
        false
      );

      scanner.render(
        async (decodedText: string) => {
          if (processingRef.current) return;
          processingRef.current = true;
          setScanning(true);

          try {
            // Extract visit ID from URL
            const visitId = extractVisitId(decodedText);
            if (!visitId) {
              setLastResult({ status: "error", message: "QR bukan tiket klinik yang valid" });
              return;
            }
            const result = await onScan(visitId);
            setLastResult(result);
          } finally {
            setScanning(false);
            // Allow next scan after 2 seconds
            setTimeout(() => {
              processingRef.current = false;
            }, 2000);
          }
        },
        (err: string) => {
          // Ignore decode errors (user scanning)
        }
      );

      scannerRef.current = scanner;
    } catch (err) {
      setCameraError("Tidak dapat mengakses kamera. Pastikan izin kamera sudah diberikan.");
    }
  }

  function stopScanner() {
    if (scannerRef.current) {
      try {
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
  }

  function extractVisitId(url: string): string | null {
    try {
      // Try parse as URL
      const u = new URL(url);
      const parts = u.pathname.split("/");
      const visitIdx = parts.indexOf("visit");
      if (visitIdx !== -1 && parts[visitIdx + 1]) {
        return parts[visitIdx + 1];
      }
    } catch {
      // Not a URL, try raw ULID/ID
      if (/^[0-9A-Z]{26}$/.test(url.trim())) {
        return url.trim();
      }
    }
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Camera container */}
      <div className="w-full max-w-sm rounded-2xl overflow-hidden border-2 border-gray-200 bg-black relative">
        {cameraError ? (
          <div className="flex items-center justify-center h-64 p-6 text-center">
            <div>
              <div className="text-4xl mb-3">📷</div>
              <p className="text-red-400 text-sm">{cameraError}</p>
            </div>
          </div>
        ) : (
          <div id="qr-scanner-container" ref={containerRef} />
        )}
        {scanning && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="text-3xl animate-spin mb-2">⟳</div>
              <p className="text-sm">Memproses...</p>
            </div>
          </div>
        )}
      </div>

      {/* Result feedback */}
      {lastResult && <ScanFeedback result={lastResult} onDismiss={() => setLastResult(null)} />}

      {/* Instructions */}
      {!lastResult && (
        <p className="text-sm text-gray-500 text-center max-w-xs">
          Arahkan kamera ke QR code pada HP pasien untuk menandai sebagai dilayani
        </p>
      )}
    </div>
  );
}

function ScanFeedback({
  result,
  onDismiss,
}: {
  result: ScanResult;
  onDismiss: () => void;
}) {
  const configs = {
    success: {
      bg: "bg-green-50 border-green-300",
      icon: "✅",
      title: "Pasien Diterima",
      textColor: "text-green-800",
    },
    already_served: {
      bg: "bg-blue-50 border-blue-300",
      icon: "ℹ️",
      title: "Sudah Dilayani",
      textColor: "text-blue-800",
    },
    revoked: {
      bg: "bg-red-50 border-red-300",
      icon: "⛔",
      title: "Kunjungan Dibatalkan",
      textColor: "text-red-800",
    },
    not_found: {
      bg: "bg-gray-50 border-gray-300",
      icon: "❓",
      title: "Tidak Ditemukan",
      textColor: "text-gray-800",
    },
    error: {
      bg: "bg-red-50 border-red-300",
      icon: "❌",
      title: "Error",
      textColor: "text-red-800",
    },
  };

  const c = configs[result.status];

  return (
    <div
      className={`w-full max-w-sm rounded-2xl border-2 p-5 text-center ${c.bg}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="text-4xl mb-2">{c.icon}</div>
      <h3 className={`font-bold text-lg ${c.textColor}`}>{c.title}</h3>
      <p className={`text-sm mt-1 ${c.textColor} opacity-80`}>{result.message}</p>
      {"serviceLabel" in result && (
        <p className={`text-sm mt-1 font-medium ${c.textColor}`}>
          Layanan: {result.serviceLabel}
        </p>
      )}
      {"servedAt" in result && (
        <p className={`text-xs mt-1 ${c.textColor} opacity-60`}>
          Waktu: {result.servedAt}
        </p>
      )}
      <button
        onClick={onDismiss}
        className={`mt-4 text-sm underline ${c.textColor} opacity-60 hover:opacity-100`}
      >
        Scan berikutnya
      </button>
    </div>
  );
}
