import { Badge } from "~/components/ui/badge";
import { formatDate, formatTime, SERVICE_ICONS, STATUS_LABELS } from "~/lib/utils";

export interface VisitTicketData {
  id: string;
  status: string;
  createdAt: Date | string;
  servedAt?: Date | string | null;
  service: { code: string; label: string };
  servedByAdmin?: { username: string } | null;
}

const variants: Record<string, "warning" | "success" | "destructive"> = {
  waiting: "warning",
  served: "success",
  revoked: "destructive",
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

export function VisitTicket({ visit }: { visit: VisitTicketData }) {
  const icon = SERVICE_ICONS[visit.service.code] ?? "🏥";
  return (
    <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden print-ticket">
      <div className="bg-blue-600 text-white px-6 py-5 text-center">
        <div className="text-3xl mb-1" role="img" aria-label={visit.service.label}>{icon}</div>
        <div className="text-xl font-bold">{visit.service.label}</div>
        <div className="text-blue-200 text-xs mt-1 uppercase tracking-widest">
          Klinik Syamsinar Maros Self Service
        </div>
      </div>
      <div className="px-6 py-5 space-y-4">
        <div className="text-center bg-gray-50 rounded-xl py-3 px-4 border">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">No. Kunjungan</p>
          <p className="font-mono text-xl font-bold text-gray-800 tracking-widest break-all">{visit.id}</p>
        </div>
        <div className="space-y-3 text-sm">
          <Row label="Tanggal" value={formatDate(visit.createdAt)} />
          <Row label="Pukul" value={formatTime(visit.createdAt)} />
          <Row label="Status" value={
            <Badge variant={variants[visit.status] ?? "secondary"}>
              {STATUS_LABELS[visit.status] ?? visit.status}
            </Badge>
          } />
          {visit.servedAt && <Row label="Waktu Dilayani" value={formatTime(visit.servedAt)} />}
          {visit.servedByAdmin && <Row label="Dilayani Oleh" value={visit.servedByAdmin.username} />}
        </div>
      </div>
      <div className="mx-6 border-t-2 border-dashed border-gray-200" />
      <div className="px-6 py-4 text-center text-xs text-gray-400">
        Tunjukkan tiket ini kepada petugas saat dipanggil
      </div>
    </div>
  );
}
