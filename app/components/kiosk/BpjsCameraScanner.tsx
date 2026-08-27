import { useEffect, useRef, useState } from "react";

type Props = {
  step: "booking" | "card";
  onBookingScan: (bookingCode: string) => void;
  onCardScan: (cardNumber: string) => void;
};

const scannerElementId = "bpjs-checkin-camera";

function bookingCodeFromScan(decodedText: string) {
  const raw = decodedText.trim();
  if (!raw || raw.length > 500) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed.kodebooking ?? parsed.kodeBooking ?? parsed.bookingCode;
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 100);
  } catch {}

  try {
    const url = new URL(raw);
    const queryValue =
      url.searchParams.get("kodebooking") ??
      url.searchParams.get("kodeBooking") ??
      url.searchParams.get("bookingCode");
    if (queryValue) return queryValue.trim().slice(0, 100);
    const lastPath = url.pathname.split("/").filter(Boolean).at(-1);
    if (lastPath) return decodeURIComponent(lastPath).trim().slice(0, 100);
  } catch {}

  return raw.length <= 100 ? raw : null;
}

function cardNumberFromScan(decodedText: string) {
  const raw = decodedText.trim();
  if (/^\d{13}$/.test(raw)) return raw;

  // QR kartu digital Mobile JKN berisi JSON yang dikodekan sebagai Base64.
  try {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const value = parsed.nomorKartu;
    if (typeof value === "string" && /^\d{13}$/.test(value.trim())) return value.trim();
  } catch {}

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed.nomorKartu ?? parsed.nomorkartu ?? parsed.noKartu ?? parsed.cardNumber;
    if (typeof value === "string" && /^\d{13}$/.test(value.trim())) return value.trim();
  } catch {}

  try {
    const url = new URL(raw);
    const value =
      url.searchParams.get("nomorKartu") ??
      url.searchParams.get("nomorkartu") ??
      url.searchParams.get("noKartu") ??
      url.searchParams.get("cardNumber");
    if (value && /^\d{13}$/.test(value.trim())) return value.trim();
  } catch {}

  return raw.match(/(?:^|\D)(\d{13})(?:\D|$)/)?.[1] ?? null;
}

export function BpjsCameraScanner({ step, onBookingScan, onCardScan }: Props) {
  const scannerRef = useRef<any>(null);
  const stepRef = useRef(step);
  const onBookingScanRef = useRef(onBookingScan);
  const onCardScanRef = useRef(onCardScan);
  const processingRef = useRef(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Menyiapkan kamera...");

  useEffect(() => {
    stepRef.current = step;
    onBookingScanRef.current = onBookingScan;
    onCardScanRef.current = onCardScan;
    setError("");
    setStatus(step === "card" ? "Langkah 1: arahkan QR kartu Mobile JKN ke kamera" : "Langkah 2: arahkan QR kode booking ke kamera");
  }, [step]);

  useEffect(() => {
    let disposed = false;

    async function start() {
      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
        if (disposed) return;
        const scanner = new Html5Qrcode(scannerElementId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
          ],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            aspectRatio: 16 / 9,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.75);
              return { width: size, height: size };
            },
          },
          (decodedText: string) => {
            if (processingRef.current) return;
            processingRef.current = true;

            if (stepRef.current === "booking") {
              const bookingCode = bookingCodeFromScan(decodedText);
              if (!bookingCode) {
                setError("QR tidak memuat kode booking yang valid.");
                processingRef.current = false;
                return;
              }
              onBookingScanRef.current(bookingCode);
              setStatus("Data lengkap. Tekan Check-in.");
              void stop();
            } else {
              const cardNumber = cardNumberFromScan(decodedText);
              if (!cardNumber) {
                setError("QR bukan kartu Mobile JKN yang valid.");
                processingRef.current = false;
                return;
              }
              onCardScanRef.current(cardNumber);
              setStatus("Kartu terbaca. Scan QR kode booking.");
            }

            window.setTimeout(() => {
              processingRef.current = false;
            }, 800);
          },
          () => {},
        );
        try {
          await scanner.applyVideoConstraints({
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          });
        } catch {
          // Kamera tetap dapat dipakai dengan resolusi default perangkat.
        }
      } catch {
        if (!disposed) {
          setError("Kamera tidak dapat digunakan. Izinkan akses kamera atau gunakan input manual.");
          setStatus("");
        }
      }
    }

    async function stop() {
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (!scanner) return;
      try {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      } catch {}
    }

    void start();
    return () => {
      disposed = true;
      void stop();
    };
  }, []);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border-2 border-blue-200 bg-slate-950">
      <div className="relative">
        <div id={scannerElementId} className="min-h-56 w-full" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-[75%] -translate-x-1/2 -translate-y-1/2 rounded-xl border-4 border-green-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.2)]"
        />
      </div>
      <div className="bg-white p-3 text-center">
        {status && <p className="font-semibold text-blue-800">{status}</p>}
        {step === "card" && (
          <p className="mt-1 text-sm text-slate-600">
            Buka QR kartu pada Mobile JKN, lalu posisikan seluruh QR di dalam kotak hijau.
          </p>
        )}
        {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
