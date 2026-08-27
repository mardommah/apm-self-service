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
