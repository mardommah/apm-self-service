import { Button } from "~/components/ui/button";

export type Filters = { status: string; serviceCode: string; dateFrom: string; dateTo: string; search: string };

export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultFilters(): Filters {
  const today = todayString();
  return { status: "", serviceCode: "", dateFrom: today, dateTo: today, search: "" };
}

type Props = {
  filters: Filters;
  services: { code: string; label: string }[];
  onChange: (filters: Filters) => void;
  onApply: () => void;
  onReset: () => void;
};

const field = "h-9 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800";

/** One-line search + filter bar above the visits table; fields use aria-labels instead of stacked labels. */
export function VisitFilters({ filters, services, onChange, onApply, onReset }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
      className="flex flex-wrap items-center gap-2 p-3"
    >
      <input type="search" value={filters.search} onChange={(e) => set({ search: e.target.value })}
        placeholder="Cari nomor antrean / kunjungan…" aria-label="Cari kunjungan" className={`${field} w-full sm:w-auto sm:min-w-[220px] sm:flex-1`} />
      <div className="flex w-full items-center gap-1.5 sm:w-auto">
        <input type="date" value={filters.dateFrom} max={filters.dateTo || undefined}
          onChange={(e) => set({ dateFrom: e.target.value })} aria-label="Dari tanggal" className={`${field} min-w-0 flex-1`} />
        <span className="text-sm text-gray-400">–</span>
        <input type="date" value={filters.dateTo} min={filters.dateFrom || undefined}
          onChange={(e) => set({ dateTo: e.target.value })} aria-label="Sampai tanggal" className={`${field} min-w-0 flex-1`} />
      </div>
      <select value={filters.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status" className={`${field} min-w-0 flex-1 sm:flex-none`}>
        <option value="">Semua status</option>
        <option value="waiting">Menunggu</option>
        <option value="served">Dilayani</option>
        <option value="revoked">Dibatalkan</option>
      </select>
      <select value={filters.serviceCode} onChange={(e) => set({ serviceCode: e.target.value })} aria-label="Layanan" className={`${field} min-w-0 flex-1 sm:flex-none`}>
        <option value="">Semua layanan</option>
        {services.map((s) => (
          <option key={s.code} value={s.code}>{s.label}</option>
        ))}
      </select>
      <Button type="submit" size="sm">Cari</Button>
      <Button type="button" variant="ghost" size="sm" onClick={onReset} className="text-gray-600">Reset</Button>
    </form>
  );
}
