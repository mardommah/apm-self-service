import { Stethoscope } from "lucide-react";
import { poliLabel } from "~/lib/poli-call";
import type { PoliCall } from "~/server/functions/display-poli";

/** DESIGN-DISPLAY-POLI.md §10.2 (Alt B): the whole side column, last patient called. */
export function DisplayPoliCallPanel({ call, offline }: { call: PoliCall | null; offline: boolean }) {
  const poli = call ? poliLabel(call.poli) : "";
  return (
    <section
      aria-live="polite"
      className="relative flex flex-1 flex-col justify-between overflow-hidden bg-bp-navy px-12 py-11 text-white"
    >
      <div aria-hidden className="absolute left-[300px] top-[-200px] size-[560px] rounded-full border border-[#93C5FD4D]" />
      <div aria-hidden className="absolute left-[440px] top-[-60px] size-[280px] rounded-full border border-[#93C5FD33]" />
      <div className="relative flex items-center justify-between gap-4">
        <span className="flex shrink-0 items-center gap-2.5 font-caption text-[15px] tracking-[1.8px]">
          <span className={`size-2.5 rounded-full ${offline ? "bg-bp-faint" : "bg-[#4ADE80]"}`} />
          {call ? "SEDANG DIPANGGIL" : "MENUNGGU PANGGILAN"}
        </span>
        {call && (
          <span className="truncate border border-bp-sky px-3 py-1.5 font-caption text-[13px] uppercase text-bp-sky">{call.poli}</span>
        )}
      </div>
      {call ? (
        <>
          <div className="relative flex min-w-0 flex-col gap-2.5">
            <span className="font-body text-2xl text-[#BFDBFE]">Nomor Antrean</span>
            <span
              className={`font-display font-medium leading-[0.9] tabular-nums ${
                call.queueNumber.length >= 6 ? "text-[150px] tracking-[-6px]" : "text-[176px] tracking-[-7px]"
              }`}
            >
              {call.queueNumber}
            </span>
            <span className="mt-2 line-clamp-2 break-words font-display text-[44px] font-medium uppercase leading-[1.1]">{call.pasien}</span>
            <span className="truncate font-body text-2xl text-[#BFDBFE]">{call.dokter}</span>
          </div>
          {/* Stacked so long names ("Poli Penyakit Dalam", "Poli Umum (Dokter Umum)") show in full. */}
          <div className="relative flex flex-col items-start gap-3 border-t border-[#FFFFFF33] pt-5">
            <span className="font-body text-[26px]">Silakan menuju</span>
            <span
              className={`max-w-full break-words border-2 border-white px-4 py-1 font-display font-medium leading-tight tracking-[-1px] ${
                poli.length > 18 ? "text-[38px]" : "text-[48px]"
              }`}
            >
              {poli}
            </span>
          </div>
        </>
      ) : (
        <>
          <span className="relative font-display text-[64px] font-medium leading-none tracking-[-2px]">
            Belum ada
            <br />
            panggilan
          </span>
          <div className="relative flex items-center gap-3 border-t border-[#FFFFFF33] pt-5 font-body text-[22px] text-[#BFDBFE]">
            <Stethoscope size={24} aria-hidden className="shrink-0 text-bp-sky" />
            Tunggu nama Anda dipanggil ke ruang poli
          </div>
        </>
      )}
    </section>
  );
}
