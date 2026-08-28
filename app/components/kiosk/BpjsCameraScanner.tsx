import { useEffect, useRef, useState } from "react";

export type BpjsCheckinQrData = {
  bookingCode: string;
  cardNumber: string;
  referralNumber: string;
  medicalRecordNumber: string;
  doctorName: string;
  queueNumber: string;
};

type Props = {
  onCheckinScan: (data: BpjsCheckinQrData) => void;
};

const scannerElementId = "bpjs-checkin-camera";

function jsonFromScan(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {}

  try {
    const normalized = raw.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function checkinDataFromScan(decodedText: string) {
  const raw = decodedText.trim();
  if (!raw || raw.length > 500) return null;

  const parsed = jsonFromScan(raw);
  if (parsed) {
    const bookingValue = parsed.kodebooking ?? parsed.kodeBooking ?? parsed.bookingCode;
    const cardValue = parsed.nokapst ?? parsed.nomorKartu ?? parsed.nomorkartu ?? parsed.noKartu;
    const referralValue = parsed.noRujukan;
    const medicalRecordValue = parsed.norm;
    const doctorValue = parsed.namaDokter;
    const queueValue = parsed.nomorAntrean;
    const bookingCode = typeof bookingValue === "string" ? bookingValue.trim() : "";
    const cardNumber = typeof cardValue === "string" ? cardValue.trim() : "";
    const referralNumber = typeof referralValue === "string" ? referralValue.trim() : "";
    const medicalRecordNumber = typeof medicalRecordValue === "string" ? medicalRecordValue.trim() : "";
    const doctorName = typeof doctorValue === "string" ? doctorValue.trim() : "";
    const queueNumber = typeof queueValue === "string" ? queueValue.trim().replace(/\s+/g, " ") : "";
    if (
      bookingCode &&
      bookingCode.length <= 100 &&
      /^\d{13}$/.test(cardNumber) &&
      referralNumber &&
      medicalRecordNumber &&
      doctorName &&
      queueNumber
    ) {
      return { bookingCode, cardNumber, referralNumber, medicalRecordNumber, doctorName, queueNumber };
    }
  }
  return null;
}

export function BpjsCameraScanner({ onCheckinScan }: Props) {
  const scannerRef = useRef<any>(null);
  const onCheckinScanRef = useRef(onCheckinScan);
  const processingRef = useRef(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Menyiapkan kamera...");

  useEffect(() => {
    onCheckinScanRef.current = onCheckinScan;
    setError("");
    setStatus("Arahkan QR check-in Mobile JKN ke kamera");
  }, [onCheckinScan]);

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
            fps: 25,
            aspectRatio: 16 / 9,
            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.9);
              return { width: size, height: size };
            },
          },
          (decodedText: string) => {
            if (processingRef.current) return;
            processingRef.current = true;

            const checkinData = checkinDataFromScan(decodedText);
            if (!checkinData) {
              setError("QR check-in tidak memuat data pasien dan antrean yang lengkap.");
              processingRef.current = false;
              return;
            }
            onCheckinScanRef.current(checkinData);
            setStatus("Data kartu dan booking terbaca. Tekan Check-in.");
            void stop();

            window.setTimeout(() => {
              processingRef.current = false;
            }, 800);
          },
          () => {},
        );
        try {
          await scanner.applyVideoConstraints({
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
            advanced: [{ focusMode: "continuous" }],
          });
        } catch {
          // Kamera lama tetap dapat dipakai tanpa resolusi atau autofocus khusus.
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
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square h-[90%] -translate-x-1/2 -translate-y-1/2 rounded-xl border-4 border-green-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.2)]"
        />
      </div>
      <div className="bg-white p-3 text-center">
        {status && <p className="font-semibold text-blue-800">{status}</p>}
        <p className="mt-1 text-sm text-slate-600">
          Buka QR check-in Mobile JKN, lalu posisikan seluruh QR di dalam kotak hijau.
        </p>
        {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
