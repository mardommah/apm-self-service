import { SERVICE_ICONS } from "~/lib/utils";

interface StatRow {
  serviceCode: string;
  serviceLabel: string;
  total: number;
  waiting: number;
  served: number;
  revoked: number;
}

interface Props {
  stats: StatRow[];
}

export function StatsCards({ stats }: Props) {
  const totals = stats.reduce(
    (acc, s) => ({
      total: acc.total + Number(s.total),
      waiting: acc.waiting + Number(s.waiting),
      served: acc.served + Number(s.served),
      revoked: acc.revoked + Number(s.revoked),
    }),
    { total: 0, waiting: 0, served: 0, revoked: 0 }
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Hari Ini" value={totals.total} color="blue" icon="📊" />
        <SummaryCard label="Menunggu" value={totals.waiting} color="amber" icon="⏳" />
        <SummaryCard label="Dilayani" value={totals.served} color="green" icon="✅" />
        <SummaryCard label="Dibatalkan" value={totals.revoked} color="red" icon="❌" />
      </div>

      {/* Per service */}
      {stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.serviceCode}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl" role="img" aria-label={s.serviceLabel}>
                  {SERVICE_ICONS[s.serviceCode] ?? "🏥"}
                </span>
                <span className="font-semibold text-gray-800 text-sm leading-tight">
                  {s.serviceLabel}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold text-gray-800">{s.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-600">Menunggu</span>
                  <span className="font-bold text-amber-700">{s.waiting}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-600">Dilayani</span>
                  <span className="font-bold text-green-700">{s.served}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    green: "bg-green-50 border-green-200 text-green-800",
    red: "bg-red-50 border-red-200 text-red-800",
  };
  return (
    <div className={`rounded-xl border p-4 text-center ${colorMap[color]}`}>
      <div className="text-2xl mb-1" role="img" aria-hidden>
        {icon}
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1 opacity-80">{label}</div>
    </div>
  );
}
