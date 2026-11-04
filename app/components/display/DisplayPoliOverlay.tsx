import { BellRing, Volume2 } from "lucide-react";
import { poliCallText, poliLabel } from "~/lib/poli-call";
import type { PoliCall } from "~/server/functions/display-poli";
import type { ActiveCall } from "./useCallAnnouncer";

const WAVE_DELAYS = [0, 0.35, 0.15, 0.5, 0.25, 0.6, 0.1, 0.45];

/** DESIGN-DISPLAY-POLI.md §4: same frame and animation as DisplayCallOverlay, poli + patient instead of loket. */
export function DisplayPoliOverlay({ active }: { active: ActiveCall<PoliCall> }) {
  const { call, round, leaving } = active;
  const poli = poliLabel(call.poli);
  return (
    <div
      role="alert"
      className={`display-backdrop fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#0B1A30B8] ${
        leaving ? "display-leave" : ""
      }`}
    >
      {[
        "size-[960px] border-2 border-[#93C5FD59]",
        "size-[1180px] border-[1.5px] border-[#93C5FD33]",
        "size-[1400px] border border-[#93C5FD1F]",
      ].map((ring, i) => (
        <span key={ring} aria-hidden className={`display-ring absolute rounded-full ${ring}`} style={{ animationDelay: `${i * 0.73}s` }} />
      ))}

      <div className="display-card relative flex w-[1080px] flex-col items-center gap-6 border-2 border-bp-sky bg-bp-navy px-16 pb-[52px] pt-12 shadow-[0_24px_80px_#00000066]">
        <span className="flex max-w-full items-center gap-2.5 bg-bp-sky px-[18px] py-2.5 font-caption text-base uppercase tracking-[2px] text-bp-navy">
          <BellRing size={20} aria-hidden className="shrink-0" />
          <span className="truncate">
            {call.isRecall ? "PANGGILAN ULANG" : "PANGGILAN POLI"} · {call.poli}
          </span>
        </span>
        <div className="flex max-w-full flex-col items-center gap-3">
          <span className="font-body text-[30px] text-[#BFDBFE]">Nomor Antrean</span>
          <span
            className={`display-number font-display font-medium leading-[0.92] text-white tabular-nums ${
              call.queueNumber.length >= 6 ? "text-[240px] tracking-[-10px]" : "text-[300px] tracking-[-12px]"
            }`}
          >
            {call.queueNumber}
          </span>
          <span className="max-w-full truncate font-caption text-[44px] uppercase tracking-[8px] text-white">{call.pasien}</span>
        </div>
        <div className="flex max-w-full flex-col items-center gap-3">
          <span className="font-body text-[38px] text-white">Silakan menuju</span>
          <span
            className={`display-loket max-w-full break-words bg-white px-6 py-1.5 text-center font-display font-medium leading-tight tracking-[-2px] text-bp-navy ${
              poli.length > 18 ? "text-[60px]" : "text-[76px]"
            }`}
          >
            {poli}
          </span>
          <span className="max-w-full truncate font-body text-[26px] text-[#BFDBFE]">{call.dokter}</span>
        </div>
        <div className="flex w-full items-center justify-between gap-6 border-t border-[#FFFFFF33] pt-6">
          <div className="flex min-w-0 items-center gap-4">
            <Volume2 size={26} aria-hidden className="shrink-0 text-bp-sky" />
            <span aria-hidden className="flex h-7 shrink-0 items-center gap-[5px]">
              {WAVE_DELAYS.map((delay, i) => (
                <span key={i} className="display-wave h-full w-1 bg-bp-sky" style={{ animationDelay: `${delay}s` }} />
              ))}
            </span>
            <span className="truncate font-body text-[22px] italic text-white">“{poliCallText(call.queueNumber, call.pasien, call.poli)}”</span>
          </div>
          <span className="shrink-0 font-caption text-[15px] text-bp-sky">PANGGILAN {round} / 2</span>
        </div>
      </div>
    </div>
  );
}
