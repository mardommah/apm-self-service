import { BedSingle } from "lucide-react";
import type { KamarRow } from "~/server/functions/display-kamar";
import { formatRupiah } from "./kamarRunningText";

// Bed icons that fit between the class name and the count; more beds → text instead.
const MAX_ICONS = 4;

export function DisplayKamarList({ kamar }: { kamar: KamarRow[] }) {
  const compact = kamar.length > 5;
  return (
    <section className="flex flex-col gap-1 px-10 pb-5 pt-6">
      <div className="flex items-center gap-5 pb-2.5 font-body text-lg text-bp-muted">
        <span className="flex-1 font-medium text-bp-ink">Ketersediaan per kelas</span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-4 bg-bp-navy" /> Terisi
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-4 border border-bp-accent bg-bp-surface" /> Kosong
        </span>
      </div>
      {kamar.map((k) => {
        const kosong = Math.max(k.kapasitas - k.terisi, 0);
        const penuh = kosong === 0;
        return (
          <div key={k.kelas} className={`flex ${compact ? "h-16" : "h-[76px]"} items-center gap-[18px] border-b border-bp-border px-4 ${penuh ? "bg-bp-surface-2" : ""}`}>
            <div className="flex w-[170px] shrink-0 flex-col gap-1 font-body">
              <span className="truncate text-xl font-medium text-bp-ink">{k.kelas}</span>
              <span className="text-[15px] text-bp-muted">
                {k.tarifBeda && "mulai "}
                {formatRupiah(k.tarif)} / malam
              </span>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {k.kapasitas > MAX_ICONS ? (
                <span className="font-body text-lg text-bp-muted">{k.terisi} terisi</span>
              ) : (
                Array.from({ length: k.kapasitas }, (_, i) =>
                  i < k.terisi ? (
                    <span key={i} className="grid h-[26px] w-[34px] place-items-center bg-bp-navy text-white">
                      <BedSingle size={16} aria-hidden />
                    </span>
                  ) : (
                    <span key={i} className="grid h-[26px] w-[34px] place-items-center border border-bp-accent bg-bp-surface text-bp-accent">
                      <BedSingle size={16} aria-hidden />
                    </span>
                  ),
                )
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5 font-body">
              {penuh ? (
                <span className={`${compact ? "text-2xl" : "text-[28px]"} font-display font-medium leading-none text-bp-muted`}>Penuh</span>
              ) : (
                <span className="flex items-baseline gap-1.5">
                  <span className={`${compact ? "text-[30px]" : "text-4xl"} font-display font-medium leading-none tabular-nums text-bp-accent-ink`}>
                    {kosong}
                  </span>
                  <span className="text-lg font-medium text-bp-accent-ink">kosong</span>
                </span>
              )}
              <span className="text-[15px] text-bp-muted">dari {k.kapasitas} tempat tidur</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
