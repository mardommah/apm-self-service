import { useEffect, useRef, useState } from "react";
import type { OpRow } from "~/server/functions/display-poli-mata";

const PAGE_SIZE = 5;
const PAGE_MS = 10_000;
const FLASH_MS = 700;

const CHIP: Record<OpRow["status"], string> = {
  Menunggu: "border border-[#F59E0B] bg-[#FEF3C7] text-[#92400E]",
  "Proses Operasi": "bg-white text-bp-navy",
  Selesai: "bg-[#DCFCE7] text-[#166534]",
};

/**
 * DESIGN-DISPLAY-POLI-MATA.md §3: today's operation schedule (old SIMRS jadwaloperasi.php, no patient name).
 * More than 5 → pages of 5 every 10 s; when the operation in progress (or the next waiting one) changes, jump to its page.
 * A tile whose status changes flashes twice, without sound.
 */
export function DisplayOperasiStrip({ rows }: { rows: OpRow[] }) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const [flashing, setFlashing] = useState<Set<string>>(new Set());
  const statuses = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (pages <= 1) return setPage(0);
    const id = setInterval(() => setPage((p) => (p + 1) % pages), PAGE_MS);
    return () => clearInterval(id);
  }, [pages]);

  const focus = rows.find((r) => r.status === "Proses Operasi") ?? rows.find((r) => r.status === "Menunggu");
  useEffect(() => {
    if (focus) setPage(Math.floor(rows.indexOf(focus) / PAGE_SIZE));
  }, [focus?.key, focus?.status]);

  useEffect(() => {
    const prev = statuses.current;
    statuses.current = new Map(rows.map((r) => [r.key, r.status]));
    const changed = prev ? rows.filter((r) => prev.has(r.key) && prev.get(r.key) !== r.status).map((r) => r.key) : [];
    if (changed.length === 0) return;
    setFlashing(new Set(changed));
    const id = setTimeout(() => setFlashing(new Set()), FLASH_MS);
    return () => clearTimeout(id);
  }, [rows]);

  const current = Math.min(page, pages - 1);
  const tiles = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const ruang = [...new Set(rows.map((r) => r.ruang))].join(" / ") || "OK MATA";

  return (
    <section className="flex shrink-0 flex-col gap-3.5 border-t border-bp-ink bg-bp-surface px-10 pb-[22px] pt-[18px]">
      <div className="flex items-center justify-between font-caption text-[22px] tracking-[1px] text-bp-ink">
        <span className="flex items-center gap-3 font-bold">
          <span className="border border-bp-ink px-2.5 py-1 leading-6">02</span>
          JADWAL OPERASI HARI INI · {ruang}
        </span>
        <span className="text-bp-muted">
          {pages > 1 && `HAL ${current + 1} / ${pages} · `}
          {rows.length} JADWAL · DATA SIMRS
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="grid h-[173px] place-items-center font-body text-lg text-bp-faint">Tidak ada jadwal operasi hari ini</div>
      ) : (
        <div key={current} className="flex min-h-[173px] gap-3 animate-[fade_300ms_ease-out]">
          {tiles.map((row) => {
            const proses = row.status === "Proses Operasi";
            const selesai = row.status === "Selesai";
            const sub = proses ? "text-[#BFDBFE]" : selesai ? "text-bp-faint" : "text-bp-muted";
            return (
              <div
                key={row.key}
                className={`flex min-w-0 flex-1 basis-0 flex-col gap-2.5 border px-4 py-3.5 ${
                  proses ? "border-bp-navy bg-bp-navy text-white" : selesai ? "border-bp-border bg-bp-surface text-bp-faint" : "border-bp-border bg-bp-surface text-bp-ink"
                } ${flashing.has(row.key) ? "animate-[display-flash_300ms_2]" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-end gap-2 font-display font-medium leading-none tabular-nums">
                    <span className="text-[34px] tracking-[-1px]">{row.mulai}</span>
                    {row.selesai && <span className={`text-xl ${sub}`}>– {row.selesai}</span>}
                  </span>
                  <span className={`flex shrink-0 items-center gap-2 px-2.5 py-[5px] font-caption text-[15px] font-bold uppercase tracking-[1.4px] ${CHIP[row.status]}`}>
                    {proses && <span aria-hidden className="size-2 rounded-full bg-[#F59E0B]" />}
                    {row.status}
                  </span>
                </div>
                {/* Wraps instead of truncating: age · J.K. moves under the No. Rawat when the tile is narrow. */}
                <div className="flex flex-wrap items-center gap-x-2.5 font-caption text-[19px] leading-6">
                  <span>{row.noRawat}</span>
                  <span className={sub}>
                    {row.umur} · {row.jk}
                  </span>
                </div>
                <span className="flex-1 font-body text-base font-medium leading-[1.25]">{row.operasi}</span>
                <div className={`flex items-center justify-between gap-2 border-t pt-2 ${proses ? "border-[#FFFFFF33]" : "border-bp-border"} ${sub}`}>
                  <span className="min-w-0 font-body text-[19px] font-medium leading-6">{row.operator}</span>
                  <span className="shrink-0 font-caption text-xs uppercase">{row.ruang}</span>
                </div>
              </div>
            );
          })}
          {/* Keep tile width constant (fewer than 5 jadwal, short last page). */}
          {Array.from({ length: PAGE_SIZE - tiles.length }, (_, i) => (
            <div key={`empty-${i}`} aria-hidden className="flex-1 basis-0 border border-transparent px-4" />
          ))}
        </div>
      )}
    </section>
  );
}
