import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { formatDateTime, PATIENT_STATUS_LABELS, SERVICE_ICONS, type PatientStatus } from "~/lib/utils";
import { printTicket, receiptHtml, ticketReceipt } from "~/lib/print";
import { QrActions } from "./QrActions";
import { QrCountdown } from "./QrCountdown";

interface Props {
  visitId: string;
  queueNumber: string;
  serviceLabel: string;
  serviceCode: string;
  patientStatus?: PatientStatus | null;
  createdAt: Date | string;
  status: string;
  appUrl: string;
  barcodeEnabled: boolean;
  autoPrintEnabled: boolean;
  timeoutMs: number;
  homePath: string;
  onTimeout: () => void;
}

export function QRDisplay({
  visitId,
  queueNumber,
  serviceLabel,
  serviceCode,
  patientStatus,
  createdAt,
  status,
  appUrl,
  barcodeEnabled,
  autoPrintEnabled,
  timeoutMs,
  homePath,
  onTimeout,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(timeoutMs / 1000));
  const url = `${appUrl}/visit/${visitId}`;
  const icon = SERVICE_ICONS[serviceCode] ?? "🏥";
  const autoPrinted = useRef(false);

  useEffect(() => {
    // Ref guard: print once per visit even if the effect re-runs (StrictMode).
    if (!autoPrintEnabled || autoPrinted.current) return;
    autoPrinted.current = true;
    void handlePrint();
  }, [autoPrintEnabled]);

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
      queueNumber,
      serviceLabel,
      patientStatus,
      createdAt,
      status,
      appUrl: url,
      barcodeEnabled,
    });
  }

  return (
    <div className="flex flex-col min-h-dvh bg-gradient-to-b from-blue-50 to-white">
      <QrActions homePath={homePath} onPrint={handlePrint} />

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10 gap-8">
        {/* Header */}
        <div className="text-center">
          <div className="text-5xl mb-2" role="img" aria-label={serviceLabel}>
            {icon}
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{serviceLabel}</h1>
          {patientStatus && (
            <p className="mt-2 inline-block rounded-full bg-blue-100 px-4 py-1 text-lg font-semibold text-blue-800">
              {PATIENT_STATUS_LABELS[patientStatus]}
            </p>
          )}
          <p className="text-gray-500 mt-1 text-lg">
            {barcodeEnabled ? "Scan kode QR dengan kamera HP Anda" : "Cetak dan simpan karcis antrean Anda"}
          </p>
        </div>

        {barcodeEnabled ? (
          <>
            <div className="bg-white p-6 rounded-3xl shadow-xl border-4 border-blue-100">
              <QRCode
                value={url}
                size={260}
                level="H"
                style={{ display: "block" }}
                aria-label={`QR code untuk kunjungan ${visitId}`}
              />
            </div>

            <div className="text-center bg-blue-50 rounded-xl px-8 py-4 border border-blue-100">
              <p className="text-sm text-blue-500 font-medium uppercase tracking-widest mb-1">
                No. Kunjungan
              </p>
              <p className="font-mono text-2xl font-bold text-blue-800 tracking-wider">
                {visitId}
              </p>
            </div>
          </>
        ) : (
          // QR off: the queue details and a preview of the exact receipt that gets printed.
          <div className="flex w-full max-w-3xl flex-wrap items-start justify-center gap-8">
            <section className="min-w-[280px] flex-1 rounded-3xl border-4 border-blue-100 bg-white p-6 text-center shadow-xl">
              <p className="text-sm font-medium uppercase tracking-widest text-blue-500">Nomor Antrean</p>
              <p className="my-2 font-mono text-7xl font-bold text-blue-900">{queueNumber}</p>
              <dl className="mt-4 space-y-2 text-left text-lg">
                {[
                  ["Layanan", serviceLabel],
                  ...(patientStatus ? [["Jenis pasien", PATIENT_STATUS_LABELS[patientStatus]]] : []),
                  ["Waktu daftar", formatDateTime(createdAt)],
                  ["No. kunjungan", visitId],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-gray-100 pb-2">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className="break-all text-right font-semibold text-gray-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <figure className="flex flex-col items-center gap-2">
              <figcaption className="text-sm font-medium uppercase tracking-widest text-gray-400">Pratinjau struk</figcaption>
              <iframe
                title="Pratinjau struk"
                srcDoc={receiptHtml(ticketReceipt({ queueNumber, serviceLabel, patientStatus, createdAt }))}
                // Grows to the receipt's height so the whole slip shows without a scrollbar.
                onLoad={(event) => {
                  const body = event.currentTarget.contentDocument?.body;
                  if (body) event.currentTarget.style.height = `${body.scrollHeight + 8}px`;
                }}
                className="pointer-events-none h-64 w-[302px] border border-gray-200 bg-white shadow-md"
              />
            </figure>
          </div>
        )}

        <QrCountdown secondsLeft={secondsLeft} timeoutMs={timeoutMs} />

        <p className="text-xs text-gray-400 text-center max-w-xs">
          {barcodeEnabled
            ? "Setelah scan, simpan atau cetak tiket dari HP Anda"
            : "Simpan karcis dan tunjukkan kepada petugas saat dipanggil"}
        </p>
      </main>
    </div>
  );
}
