import { PATIENT_STATUS_LABELS, type PatientStatus } from "./utils";

export interface PrintData {
  queueNumber: string;
  patientStatus?: PatientStatus | null;
  serviceLabel: string;
  createdAt: Date | string;
  status: string;
  appUrl: string;
  barcodeEnabled?: boolean;
}

/**
 * Print via APM printer SDK (priority).
 * Falls back to browser print if APM not available.
 */
export async function printTicket(data: PrintData): Promise<void> {
  // Try APM SDK first
  const apmPrinted = await tryApmPrint(data);
  if (apmPrinted) return;

  // Fallback: browser print
  browserPrint(data);
}

export interface BpjsCheckinPrintData {
  bookingCode: string;
  cardNumber: string;
  referralNumber: string;
  medicalRecordNumber: string;
  clinicName: string;
  queueNumber: string;
}

export function printGeneralLoketQueue(number: string, loket: 1 | 2, patientStatus: PatientStatus): void {
  printReceipt({
    title: "Nomor Antrean",
    queueNumber: number,
    rows: [
      ["Layanan", `Loket Pendaftaran ${loket}`],
      ["Jenis pasien", PATIENT_STATUS_LABELS[patientStatus]],
      ["Waktu", receiptTime(new Date())],
    ],
    note: "Simpan struk & tunggu nomor dipanggil.",
  });
}

/** Print proof only after the Frista agent confirms the process has finished. */
export function printBpjsCheckin(data: BpjsCheckinPrintData): void {
  printReceipt({
    title: "Bukti Check-in BPJS",
    queueNumber: data.queueNumber,
    rows: [
      // Check-in needs a SIMRS booking, so it is always an existing patient.
      ["Jenis pasien", PATIENT_STATUS_LABELS.lama],
      ["Poli tujuan", data.clinicName],
      ["Kode booking", data.bookingCode],
      ["No. kartu", data.cardNumber],
      ["No. rujukan", data.referralNumber],
      ["No. RM", data.medicalRecordNumber],
      ["Waktu", receiptTime(new Date())],
    ],
    note: "Proses Frista selesai.",
  });
}

async function tryApmPrint(data: PrintData): Promise<boolean> {
  try {
    // APM SDK is expected to be available as window.APMPrinter
    const apm = (window as any).APMPrinter;
    if (!apm || typeof apm.print !== "function") return false;

    await apm.print({
      template: "ticket",
      data: {
        title: "Klinik Syamsinar Maros Self Service",
        queueNumber: data.queueNumber,
        service: data.serviceLabel,
        ...(data.patientStatus ? { patientStatus: PATIENT_STATUS_LABELS[data.patientStatus] } : {}),
        date: new Date(data.createdAt).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        time: new Date(data.createdAt).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        ...(data.barcodeEnabled ? { qrData: data.appUrl } : {}),
      },
    });
    return true;
  } catch {
    return false;
  }
}

function browserPrint(data: PrintData): void {
  printReceipt(ticketReceipt(data));
}

export type Receipt = { title: string; queueNumber: string; rows: [string, string][]; note: string };

/** Kiosk ticket receipt; also rendered as the on-screen preview (QRDisplay without QR). */
export function ticketReceipt(data: Pick<PrintData, "queueNumber" | "serviceLabel" | "patientStatus" | "createdAt">): Receipt {
  return {
    title: "Nomor Antrean",
    queueNumber: data.queueNumber,
    rows: [
      ["Layanan", data.serviceLabel],
      ...(data.patientStatus ? [["Jenis pasien", PATIENT_STATUS_LABELS[data.patientStatus]] as [string, string]] : []),
      ["Waktu", receiptTime(new Date(data.createdAt))],
    ],
    note: "Simpan struk & tunggu nomor dipanggil.",
  };
}

/** "31 Okt 2026 08.21 WITA" */
function receiptTime(date: Date) {
  const day = date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const time = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time} WITA`;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);

// One layout for every receipt (80 mm thermal roll). Paper saving: no page margin, 11px text,
// tight line height, label + value on one line, a single short footer line.
const RECEIPT_CSS = `
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 72mm; margin: 0 auto; padding: 2mm 0 3mm; font: 11px/1.25 monospace; color: #000; }
  .center { text-align: center; }
  .clinic { font-size: 13px; font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 3px 0; }
  .title { font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
  .number { font-size: 34px; font-weight: bold; line-height: 1.05; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .row b { text-align: right; overflow-wrap: anywhere; }
`;

/** Shared receipt HTML: clinic header, title, big queue number, label/value rows, one footer note. */
export function receiptHtml(receipt: Receipt) {
  return `<!doctype html><html lang="id"><head><meta charset="UTF-8"><title>${escapeHtml(receipt.title)}</title>
    <style>${RECEIPT_CSS}</style></head><body>
    <div class="center"><div class="clinic">KLINIK SYAMSINAR MAROS</div><div>Jl. Poros Maros-Makassar No.6<br>Telp. 085315403288</div></div>
    <div class="divider"></div>
    <div class="center"><div class="title">${escapeHtml(receipt.title)}</div><div class="number">${escapeHtml(receipt.queueNumber)}</div></div>
    <div class="divider"></div>
    ${receipt.rows.map(([label, value]) => `<div class="row"><span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join("")}
    <div class="divider"></div>
    <div class="center">${escapeHtml(receipt.note)}</div>
    </body></html>`;
}

function printReceipt(receipt: Receipt) {
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.title = receipt.title;
  document.body.appendChild(frame);
  const page = frame.contentDocument;
  if (!page) {
    frame.remove();
    throw new Error("PRINT_UNAVAILABLE");
  }
  page.open();
  page.write(receiptHtml(receipt));
  page.close();
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1_000);
  }, 200);
}
