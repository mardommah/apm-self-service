import { SERVICE_ICONS } from "~/lib/utils";

interface StatRow {
  serviceCode: string;
  serviceLabel: string;
  total: number;
  waiting: number;
  served: number;
  revoked: number;
}

const KPIS = [
  { key: "total", label: "Total kunjungan", dot: "bg-blue-500" },
  { key: "waiting", label: "Belum dilayani", dot: "bg-amber-500" },
  { key: "served", label: "Dilayani", dot: "bg-green-600" },
  { key: "revoked", label: "Dibatalkan", dot: "bg-red-500" },
] as const;

/** Compact daily summary: four totals in one row, per-service breakdown underneath. */
export function StatsCards({ stats }: { stats: StatRow[] }) {
  const totals = stats.reduce(
    (acc, s) => ({
      total: acc.total + Number(s.total),
      waiting: acc.waiting + Number(s.waiting),
      served: acc.served + Number(s.served),
      revoked: acc.revoked + Number(s.revoked),
    }),
    { total: 0, waiting: 0, served: 0, revoked: 0 },
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <dl className="grid grid-cols-2 divide-gray-100 md:grid-cols-4 md:divide-x">
        {KPIS.map((kpi) => (
          <div key={kpi.key} className="px-5 py-4">
            <dt className="flex items-center gap-2 text-sm text-gray-500">
              <span aria-hidden className={`size-2 rounded-full ${kpi.dot}`} />
              {kpi.label}
            </dt>
            <dd className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{totals[kpi.key]}</dd>
          </div>
        ))}
      </dl>
      {stats.length > 0 && (
        <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t border-gray-100 px-5 py-3 text-sm">
          {stats.map((s) => (
            <li key={s.serviceCode} className="flex items-center gap-2 text-gray-600">
              <span aria-hidden>{SERVICE_ICONS[s.serviceCode] ?? "🏥"}</span>
              <span className="font-medium text-gray-800">{s.serviceLabel}</span>
              <span className="tabular-nums">
                {s.total} total · <span className="text-amber-700">{s.waiting} belum</span> ·{" "}
                <span className="text-green-700">{s.served} dilayani</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
