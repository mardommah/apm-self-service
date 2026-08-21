import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatDate, formatTime, SERVICE_ICONS, STATUS_LABELS } from "~/lib/utils";

interface VisitRow {
  id: string;
  status: string;
  createdAt: Date | string;
  scannedAt?: Date | string | null;
  servedAt?: Date | string | null;
  service: { code: string; label: string };
  servedByAdmin?: { username: string } | null;
}

interface Props {
  visits: VisitRow[];
  onServe: (id: string) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  loading?: string | null; // visit id being processed
}

const statusVariant: Record<string, "warning" | "success" | "destructive" | "secondary"> = {
  waiting: "warning",
  served: "success",
  revoked: "destructive",
};

export function VisitsTable({ visits, onServe, onRevoke, onDelete, loading }: Props) {
  const [confirm, setConfirm] = useState<{ action: "revoke" | "delete"; id: string } | null>(null);

  if (visits.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-5xl mb-3">📭</div>
        <p className="text-lg font-medium">Belum ada kunjungan</p>
        <p className="text-sm mt-1">Data akan muncul ketika pasien melakukan registrasi</p>
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
              {confirm.action === "delete" ? "Hapus Data?" : "Revoke Kunjungan?"}
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
              <th className="text-left px-4 py-3 font-semibold text-gray-600">No. Kunjungan</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Layanan</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Tanggal & Waktu</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Scan HP</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Dilayani</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visits.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-700 max-w-[140px] truncate">
                  {v.id}
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    <span role="img" aria-hidden>
                      {SERVICE_ICONS[v.service.code] ?? "🏥"}
                    </span>
                    {v.service.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  <div>{formatDate(v.createdAt)}</div>
                  <div className="text-xs text-gray-400">{formatTime(v.createdAt)}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant[v.status] ?? "secondary"}>
                    {STATUS_LABELS[v.status] ?? v.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {v.scannedAt ? (
                    <span className="text-green-600">✓ {formatTime(v.scannedAt)}</span>
                  ) : (
                    <span className="text-gray-300">Belum scan</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {v.servedAt ? (
                    <div>
                      <div className="text-green-600">✓ {formatTime(v.servedAt)}</div>
                      {v.servedByAdmin && (
                        <div className="text-gray-400">{v.servedByAdmin.username}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
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
                    {v.status !== "revoked" && (
                      <Button
                        size="sm"
                        variant="warning"
                        disabled={loading === v.id}
                        onClick={() => setConfirm({ action: "revoke", id: v.id })}
                      >
                        Revoke
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={loading === v.id}
                      onClick={() => setConfirm({ action: "delete", id: v.id })}
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
