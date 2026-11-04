import { useEffect, useState } from "react";
import { titleCaseName } from "~/lib/poli-call";
import type { PoliBoardRow } from "~/server/functions/display-poli";

const PAGE_SIZE = 7;
const PAGE_MS = 10_000;

/**
 * DESIGN-DISPLAY-POLI.md §10.2 (Alt B): one tile per poli with a schedule today, full width under the video.
 * More than 7 polis → pages of 7 every 10s; a new call jumps to the page of its poli.
 */
export function DisplayPoliStrip({ board, activePoli, flashPoli }: { board: PoliBoardRow[]; activePoli?: string; flashPoli?: string }) {
  const pages = Math.max(1, Math.ceil(board.length / PAGE_SIZE));
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (pages <= 1) return setPage(0);
    const id = setInterval(() => setPage((p) => (p + 1) % pages), PAGE_MS);
    return () => clearInterval(id);
  }, [pages]);

  useEffect(() => {
    const index = board.findIndex((row) => row.kdPoli === activePoli);
    if (index >= 0) setPage(Math.floor(index / PAGE_SIZE));
  }, [activePoli]);

  const current = Math.min(page, pages - 1);
  const tiles = board.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  return (
    <section className="flex h-[252px] shrink-0 flex-col gap-3 border-t border-bp-ink bg-bp-surface px-10 pb-[22px] pt-[18px]">
      <div className="flex justify-between font-caption text-[13px] text-bp-muted">
        <span>ANTREAN PER POLI</span>
        <span>
          {board.length} POLI HARI INI · NOMOR TERAKHIR{pages > 1 && ` · HAL ${current + 1} / ${pages}`}
        </span>
      </div>
      {board.length === 0 ? (
        <div className="grid flex-1 place-items-center font-body text-[20px] text-bp-muted">Tidak ada jadwal poli hari ini</div>
      ) : (
        <div key={current} className="flex min-h-0 flex-1 gap-3 animate-[fade_300ms_ease-out]">
          {tiles.map((row) => {
            const active = row.kdPoli === activePoli;
            return (
              <div
                key={row.kdPoli}
                className={`flex min-w-0 flex-1 basis-0 flex-col justify-between border px-[18px] py-3 ${
                  active ? "border-bp-accent-ink bg-bp-accent-ink" : "border-bp-border"
                } ${flashPoli === row.kdPoli ? "animate-[display-flash_300ms_2]" : ""}`}
              >
                <span className={`flex items-center justify-between gap-2 font-caption text-sm uppercase ${active ? "text-white" : "text-bp-ink"}`}>
                  <span className="truncate">{row.poli}</span>
                  {active && <span aria-hidden className="size-2 shrink-0 rounded-full bg-[#4ADE80]" />}
                </span>
                <span
                  className={`font-display text-[44px] font-medium leading-none tracking-[-1.5px] tabular-nums ${
                    active ? "text-white" : row.queueNumber ? "text-bp-ink" : "text-bp-faint"
                  }`}
                >
                  {row.queueNumber ?? "—"}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={`truncate font-body text-[21px] font-medium ${active ? "text-white" : row.pasien ? "text-bp-ink" : "text-bp-faint"}`}>
                    {row.pasien ? titleCaseName(row.pasien) : "Belum ada panggilan"}
                  </span>
                  <span className={`truncate font-body text-[17px] ${active ? "text-[#BFDBFE]" : "text-bp-muted"}`}>{row.dokter}</span>
                </span>
              </div>
            );
          })}
          {/* Keep tile width constant on a short last page. */}
          {Array.from({ length: pages > 1 ? PAGE_SIZE - tiles.length : 0 }, (_, i) => (
            <div key={`empty-${i}`} aria-hidden className="flex-1 basis-0" />
          ))}
        </div>
      )}
    </section>
  );
}
