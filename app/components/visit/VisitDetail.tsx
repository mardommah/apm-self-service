import { formatDate, formatTime, SERVICE_ICONS, STATUS_LABELS } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { printTicket } from "~/lib/print";

interface VisitData {
  id: string;
  status: string;
  createdAt: Date | string;
  scannedAt?: Date | string | null;
  servedAt?: Date | string | null;
  service: { code: string; label: string };
  servedByAdmin?: { username: string } | null;
}

interface Props {
  visit: VisitData;
  appUrl: string;
}

const statusVariant: Record<string, "warning" | "success" | "destructive"> = {
  waiting: "warning",
  served: "success",
  revoked: "destructive",
};

export function VisitDetail({ visit, appUrl }: Props) {
  const icon = SERVICE_ICONS[visit.service.code] ?? "🏥";

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

      {/* Ticket card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden print-ticket">
        {/* Ticket header */}
        <div className="bg-blue-600 text-white px-6 py-5 text-center">
          <div className="text-3xl mb-1" role="img" aria-label={visit.service.label}>
            {icon}
          </div>
          <div className="text-xl font-bold">{visit.service.label}</div>
          <div className="text-blue-200 text-xs mt-1 uppercase tracking-widest">
            Klinik Syamsinar Maros Self Service
          </div>
        </div>

        {/* Ticket body */}
        <div className="px-6 py-5 space-y-4">
          {/* No. Kunjungan */}
          <div className="text-center bg-gray-50 rounded-xl py-3 px-4 border">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">No. Kunjungan</p>
            <p className="font-mono text-xl font-bold text-gray-800 tracking-widest break-all">
              {visit.id}
            </p>
          </div>

          {/* Details */}
          <div className="space-y-3 text-sm">
            <Row label="Tanggal" value={formatDate(visit.createdAt)} />
            <Row label="Pukul" value={formatTime(visit.createdAt)} />
            <Row
              label="Status"
              value={
                <Badge variant={statusVariant[visit.status] ?? "secondary"}>
                  {STATUS_LABELS[visit.status] ?? visit.status}
                </Badge>
              }
            />
            {visit.servedAt && (
              <Row label="Waktu Dilayani" value={formatTime(visit.servedAt)} />
            )}
            {visit.servedByAdmin && (
              <Row label="Dilayani Oleh" value={visit.servedByAdmin.username} />
            )}
          </div>
        </div>

        {/* Dashed separator */}
        <div className="mx-6 border-t-2 border-dashed border-gray-200" />

        <div className="px-6 py-4 text-center text-xs text-gray-400">
          Tunjukkan tiket ini kepada petugas saat dipanggil
        </div>
      </div>

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

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}
