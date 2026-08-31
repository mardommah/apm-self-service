export interface PrintData {
  visitId: string;
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

/** Print proof only after the Frista agent confirms the process has finished. */
export function printBpjsCheckin(data: BpjsCheckinPrintData): void {
  const escapeHtml = (value: string) =>
    value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[character]!);
  const rows = [
    ["Kode booking", data.bookingCode],
    ["Nomor kartu", data.cardNumber],
    ["Nomor rujukan", data.referralNumber],
    ["Nomor RM", data.medicalRecordNumber],
    ["Poli tujuan", data.clinicName],
    ["Nomor antrean", data.queueNumber],
  ];
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.setAttribute("title", "Cetak bukti check-in BPJS");
  document.body.appendChild(frame);
  const documentToPrint = frame.contentDocument;
  if (!documentToPrint) {
    frame.remove();
    throw new Error("PRINT_UNAVAILABLE");
  }
  documentToPrint.open();
  documentToPrint.write(`<!doctype html>
    <html lang="id"><head><meta charset="UTF-8"><title>Bukti Check-in BPJS</title>
    <style>
      @page { size: 80mm auto; margin: 5mm; }
      body { width: 70mm; margin: 0; font: 12px monospace; color: #000; }
      h1, p { margin: 0; text-align: center; }
      h1 { font-size: 16px; }
      .divider { border-top: 1px dashed #000; margin: 8px 0; }
      .row { margin: 6px 0; }
      .label { display: block; color: #555; }
      .value { display: block; font-weight: bold; overflow-wrap: anywhere; }
      .queue { font-size: 20px; text-align: center; }
    </style></head><body>
      <h1>Klinik Syamsinar Maros</h1><p>Bukti Check-in BPJS</p><div class="divider"></div>
      ${rows.map(([label, value], index) => `<div class="row${index === rows.length - 1 ? " queue" : ""}"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span></div>`).join("")}
      <div class="divider"></div><p>Proses Frista selesai</p>
    </body></html>`);
  documentToPrint.close();
  window.setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1_000);
  }, 200);
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
        visitId: data.visitId,
        service: data.serviceLabel,
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
  const date = new Date(data.createdAt);
  const dateStr = date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <title>Tiket Kunjungan</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: monospace;
          width: 80mm;
          padding: 8mm;
          font-size: 12px;
        }
        .center { text-align: center; }
        .title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .row { display: flex; justify-content: space-between; margin: 4px 0; }
        .label { color: #666; }
        .value { font-weight: bold; }
        .id { font-size: 14px; font-weight: bold; letter-spacing: 2px; text-align: center; margin: 8px 0; }
        .footer { font-size: 10px; color: #999; text-align: center; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="center">
        <div class="title">Klinik Syamsinar Maros Self Service</div>
        <div>Tiket Kunjungan</div>
      </div>
      <div class="divider"></div>
      <div class="id">${data.visitId}</div>
      <div class="divider"></div>
      <div class="row"><span class="label">Layanan</span><span class="value">${data.serviceLabel}</span></div>
      <div class="row"><span class="label">Tanggal</span><span class="value">${dateStr}</span></div>
      <div class="row"><span class="label">Pukul</span><span class="value">${timeStr} WIB</span></div>
      <div class="row"><span class="label">Status</span><span class="value">Menunggu</span></div>
      <div class="divider"></div>
      <div class="footer">Simpan tiket ini. Tunjukkan kepada petugas saat dipanggil.</div>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 300);
}
