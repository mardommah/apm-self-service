import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatDate, formatTime, SERVICE_ICONS, STATUS_LABELS } from "~/lib/utils";

// Table shows wall-clock time only; the "GMT+8" suffix from formatTime is noise in a same-day list.
const clock = (date: Date | string) => formatTime(date).replace(/\s*GMT.*$/, "");

interface VisitRow {
  id: string;
  queueNumber: string;
  status: string;
  createdAt: Date | string;
  scannedAt?: Date | string | null;
  servedAt?: Date | string | null;
  service: { code: string; label: string };
  servedByAdmin?: { username: string } | null;
  called?: boolean;
  callFinished?: boolean;
}

interface Props {
  visits: VisitRow[];
  onServe: (id: string) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCall: (visit: VisitRow) => Promise<void>;
  onFinish: (id: string) => Promise<void>;
  loading?: string | null; // visit id being processed
}

const statusVariant: Record<string, "warning" | "success" | "destructive" | "secondary"> = {
  waiting: "warning",
  served: "success",
  revoked: "destructive",
};

export function VisitsTable({ visits, onServe, onRevoke, onDelete, onCall, onFinish, loading }: Props) {
  const [confirm, setConfirm] = useState<{ action: "revoke" | "delete"; id: string } | null>(null);

  if (visits.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-5xl mb-3">📭</div>
        <p className="text-lg font-medium">Tidak ada kunjungan</p>
        <p className="text-sm mt-1">Tidak ada data untuk filter ini</p>
      </div>
    );
  }

  return (
    <>
      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <div className="text-4xl mb-3">
              {confirm.action === "delete" ? "🗑️" : "⚠️"}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {confirm.action === "delete" ? "Hapus Data?" : "Batalkan Kunjungan?"}
            </h3>
            <p className="text-gray-500 text-sm mb-6">
              {confirm.action === "delete"
                ? "Data kunjungan ini akan dihapus permanen."
                : "Status kunjungan akan diubah menjadi 'Dibatalkan'."}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirm(null)}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={async () => {
                  if (confirm.action === "delete") await onDelete(confirm.id);
                  else await onRevoke(confirm.id);
                  setConfirm(null);
                }}
              >
                Ya, Lanjutkan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">No. Antrean</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Layanan</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Daftar</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500">Status</th>
              <th className="text-right px-4 py-2.5 font-medium text-gray-500">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visits.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                {/* Visit id is only needed for support/search, so it sits small under the queue number. */}
                <td className="px-4 py-3">
                  <div className="font-mono text-base font-bold text-gray-900">{v.queueNumber}</div>
                  <div className="max-w-[120px] truncate font-mono text-[11px] text-gray-400" title={v.id}>{v.id}</div>
                </td>
                <td className="px-4 py-3 text-gray-800">
                  <span className="flex items-center gap-1.5">
                    <span role="img" aria-hidden>
                      {SERVICE_ICONS[v.service.code] ?? "🏥"}
                    </span>
                    {v.service.label}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-700" title={formatDate(v.createdAt)}>
                  {clock(v.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant[v.status] ?? "secondary"}>
                    {STATUS_LABELS[v.status] ?? v.status}
                  </Badge>
                  {(v.servedAt || v.scannedAt) && (
                    <div className="mt-1 text-xs text-gray-500">
                      {v.servedAt
                        ? `${clock(v.servedAt)}${v.servedByAdmin ? ` · ${v.servedByAdmin.username}` : ""}`
                        : `Scan HP ${clock(v.scannedAt!)}`}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {v.status === "waiting" && (
                      <Button size="sm" variant="outline" disabled={loading === v.id} onClick={() => onCall(v)}>
                        🔊 Panggil
                      </Button>
                    )}
                    {v.status === "waiting" && (
                      <Button
                        size="sm"
                        variant="success"
                        disabled={loading === v.id}
                        onClick={() => onServe(v.id)}
                      >
                        {loading === v.id ? "..." : "✓ Layani"}
                      </Button>
                    )}
                    {v.status === "served" && v.called && !v.callFinished && (
                      <Button size="sm" variant="success" disabled={loading === v.id} onClick={() => onFinish(v.id)}>
                        {loading === v.id ? "..." : "✓ Selesai"}
                      </Button>
                    )}
                    {/* Rare, destructive actions: quiet text buttons, separated from the daily actions. */}
                    <span aria-hidden className="mx-1 h-6 w-px bg-gray-200" />
                    {v.status !== "revoked" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={loading === v.id}
                        onClick={() => setConfirm({ action: "revoke", id: v.id })}
                        className="text-amber-700 hover:bg-amber-50"
                      >
                        Batalkan
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={loading === v.id}
                      onClick={() => setConfirm({ action: "delete", id: v.id })}
                      className="text-red-600 hover:bg-red-50"
                    >
                      Hapus
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
