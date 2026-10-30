import { BellRing, Volume2 } from "lucide-react";
import { callText } from "~/lib/announce";
import type { ActiveCall } from "./useCallAnnouncer";

const WAVE_DELAYS = [0, 0.35, 0.15, 0.5, 0.25, 0.6, 0.1, 0.45];

export function DisplayCallOverlay({ active }: { active: ActiveCall }) {
  const { call, round, leaving } = active;
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
        <span
          key={ring}
          aria-hidden
          className={`display-ring absolute rounded-full ${ring}`}
          style={{ animationDelay: `${i * 0.73}s` }}
        />
      ))}

      <div className="display-card relative flex w-[1080px] flex-col items-center gap-7 border-2 border-bp-sky bg-bp-navy px-16 pb-[52px] pt-12 shadow-[0_24px_80px_#00000066]">
        <span className="flex items-center gap-2.5 bg-bp-sky px-[18px] py-2.5 font-caption text-base uppercase tracking-[2px] text-bp-navy">
          <BellRing size={20} aria-hidden />
          {call.isRecall ? "PANGGILAN ULANG" : "PANGGILAN ANTREAN"} · {call.serviceLabel}
        </span>
        <div className="flex flex-col items-center gap-1">
          <span className="font-body text-[30px] text-[#BFDBFE]">Nomor Antrean</span>
          <span className="display-number font-display text-[300px] font-medium leading-[0.92] tracking-[-12px] text-white tabular-nums">
            {call.queueNumber}
          </span>
        </div>
        <div className="flex items-center gap-6">
          <span className="font-body text-[38px] text-white">Silakan menuju</span>
          <span className="display-loket bg-white px-6 py-1.5 font-display text-[84px] font-medium tracking-[-2.5px] text-bp-navy">
            Loket {String(call.loket).padStart(2, "0")}
          </span>
        </div>
        <div className="flex w-full items-center justify-between border-t border-[#FFFFFF33] pt-6">
          <div className="flex min-w-0 items-center gap-4">
            <Volume2 size={26} aria-hidden className="shrink-0 text-bp-sky" />
            <span aria-hidden className="flex h-7 items-center gap-[5px]">
              {WAVE_DELAYS.map((delay, i) => (
                <span key={i} className="display-wave h-full w-1 bg-bp-sky" style={{ animationDelay: `${delay}s` }} />
              ))}
            </span>
            <span className="truncate font-body text-[22px] italic text-white">
              “{callText(call.queueNumber, call.serviceLabel, call.loket)}”
            </span>
          </div>
          <span className="shrink-0 font-caption text-[15px] text-bp-sky">PANGGILAN {round} / 2</span>
        </div>
      </div>
    </div>
  );
}
