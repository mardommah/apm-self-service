import { Stethoscope } from "lucide-react";
import { titleCaseName } from "~/lib/poli-call";
import type { PoliCall } from "~/server/functions/display-poli";
import type { CalledRow } from "~/server/functions/display-poli-mata";

/** DESIGN-DISPLAY-POLI-MATA.md §2: column header, last Poli Mata call, the 3 patients called before it (sudah terlayani). */
export function DisplayPoliMataPanel({ call, called, offline }: { call: PoliCall | null; called: CalledRow[]; offline: boolean }) {
  return (
    <aside className="flex w-[720px] shrink-0 flex-col border-l border-bp-ink bg-bp-surface">
      <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-bp-ink px-10">
        <span className="flex items-center gap-3.5">
          <span className="border border-bp-ink px-2 py-[3px] font-caption text-sm text-bp-ink">01</span>
          <span className="font-display text-[28px] font-medium tracking-[-0.5px] text-bp-ink">Antrean Poli Mata</span>
        </span>
        <span className="font-caption text-[13px] tracking-[1.4px] text-bp-muted">RUANG POLI</span>
      </div>

      <section aria-live="polite" className="relative flex shrink-0 flex-col gap-[22px] overflow-hidden bg-bp-navy px-10 pb-8 pt-7 text-white">
        <div aria-hidden className="absolute left-[600px] top-[-220px] size-[520px] rounded-full border border-[#93C5FD4D]" />
        <div aria-hidden className="absolute left-[730px] top-[-90px] size-[260px] rounded-full border border-[#93C5FD33]" />
        <span className="relative flex items-center gap-2.5 font-caption text-[15px] tracking-[1.8px]">
          <span className={`size-2.5 rounded-full ${offline ? "bg-bp-faint" : "bg-[#4ADE80]"}`} />
          {call ? "SEDANG DIPANGGIL" : "MENUNGGU PANGGILAN"}
        </span>
        {call ? (
          <div className="relative flex min-w-0 flex-col gap-2">
            <span className="font-display text-[124px] font-medium leading-[0.9] tracking-[-6px] tabular-nums">{call.queueNumber}</span>
            <span className="truncate font-display text-[32px] font-medium uppercase leading-[1.25]">{call.pasien}</span>
          </div>
        ) : (
          <span className="relative font-display text-[64px] font-medium leading-none tracking-[-2px]">
            Belum ada
            <br />
            panggilan
          </span>
        )}
        {call ? (
          <div className="relative flex items-center justify-between gap-4 border-t border-[#FFFFFF33] pt-[18px]">
            <span className="font-body text-[22px] text-[#BFDBFE]">Silakan menuju</span>
            <span className="border-2 border-white px-4 py-1.5 font-display text-[40px] font-medium leading-[1.1] tracking-[-1px]">Ruang Poli</span>
          </div>
        ) : (
          <div className="relative flex items-center gap-3 border-t border-[#FFFFFF33] pt-[18px] font-body text-[22px] text-[#BFDBFE]">
            <Stethoscope size={24} aria-hidden className="shrink-0 text-bp-sky" />
            Tunggu nama Anda dipanggil ke ruang poli
          </div>
        )}
      </section>

      <div className="flex min-h-0 flex-1 flex-col px-10 pt-5">
        <div className="flex gap-6 border-b border-bp-ink pb-3 font-caption text-[13px] tracking-[1.4px] text-bp-muted">
          <span className="w-[150px]">NO. ANTREAN</span>
          <span className="flex-1">NAMA PASIEN</span>
          <span>KETERANGAN</span>
        </div>
        {called.length === 0 ? (
          <div className="flex flex-1 items-center border-b border-bp-border font-body text-2xl text-bp-faint">Belum ada pasien terlayani</div>
        ) : (
          called.map((row) => (
            <div key={row.noRawat} className="flex min-h-0 flex-1 items-center gap-6 border-b border-bp-border">
              <span className="w-[150px] font-display text-[34px] font-medium tracking-[-1px] text-bp-ink tabular-nums">{row.number}</span>
              <span className="min-w-0 flex-1 truncate font-body text-2xl text-bp-ink">{titleCaseName(row.pasien)}</span>
              <span className="shrink-0 bg-[#DCFCE7] px-2.5 py-[5px] font-caption text-[13px] uppercase tracking-[1.4px] text-[#166534]">Sudah terlayani</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
