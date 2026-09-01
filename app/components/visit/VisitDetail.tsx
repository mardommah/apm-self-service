import { Button } from "~/components/ui/button";
import { printTicket } from "~/lib/print";
import { VisitTicket, type VisitTicketData } from "./VisitTicket";

interface VisitData extends VisitTicketData {
  scannedAt?: Date | string | null;
}

interface Props {
  visit: VisitData;
  appUrl: string;
}

export function VisitDetail({ visit, appUrl }: Props) {
  async function handlePrint() {
    await printTicket({
      visitId: visit.id,
      serviceLabel: visit.service.label,
      createdAt: visit.createdAt,
      status: visit.status,
      appUrl: `${appUrl}/visit/${visit.id}`,
    });
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-start px-4 py-8 gap-6">
      {/* Success header */}
      <div className="text-center">
        {visit.status === "revoked" ? (
          <>
            <div className="text-6xl mb-2">❌</div>
            <h1 className="text-2xl font-bold text-red-700">Kunjungan Dibatalkan</h1>
            <p className="text-red-500 mt-1">Kunjungan ini telah dibatalkan.</p>
          </>
        ) : (
          <>
            <div className="text-6xl mb-2">✅</div>
            <h1 className="text-2xl font-bold text-green-700">Registrasi Berhasil</h1>
            <p className="text-green-600 mt-1">Simpan tiket ini sebagai bukti antrian</p>
          </>
        )}
      </div>

      <VisitTicket visit={visit} />

      {/* Print buttons */}
      {visit.status !== "revoked" && (
        <div className="w-full max-w-sm flex flex-col gap-3 no-print">
          <Button size="lg" onClick={handlePrint} className="w-full">
            🖨️ Cetak via Printer
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => window.print()}
            className="w-full"
          >
            📄 Cetak via Browser
          </Button>
        </div>
      )}

      <div className="w-full max-w-sm no-print">
        <Button asChild variant="secondary" size="lg" className="w-full">
          <a href="/">&larr; Kembali ke Home</a>
        </Button>
      </div>

      <p className="text-xs text-gray-400 text-center max-w-xs no-print">
        Screenshot atau cetak halaman ini untuk menyimpan nomor antrian Anda
      </p>
    </div>
  );
}
