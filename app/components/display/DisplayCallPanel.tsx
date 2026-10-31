import { Ticket } from "lucide-react";
import type { CallStatus, QueueCall } from "~/server/functions/calls";

const HEADER: Record<CallStatus, string> = {
  called: "SEDANG DIPANGGIL",
  serving: "SEDANG DILAYANI",
  finished: "SELESAI DILAYANI",
};

function CurrentCall({ call }: { call: QueueCall }) {
  return (
    <>
      <div className="relative flex flex-col gap-1.5">
        <span className="font-body text-2xl text-[#BFDBFE]">Nomor Antrean</span>
        <span className="font-display text-[176px] font-medium leading-[0.9] tracking-[-7px] tabular-nums">
          {call.queueNumber}
        </span>
      </div>
      <div className="relative flex items-center justify-between border-t border-[#FFFFFF33] pt-5">
        <span className="font-body text-[26px]">Silakan menuju</span>
        <span className="border-2 border-white px-4 py-1 font-display text-[56px] font-medium tracking-[-1.5px]">
          Loket {String(call.loket).padStart(2, "0")}
        </span>
      </div>
    </>
  );
}

/** Shown before the first call of the day (DESIGN.md §9.4, state "Menunggu panggilan"). */
function WaitingForCall() {
  return (
    <>
      <div className="relative flex flex-col gap-4">
        <span className="font-display text-[64px] font-medium leading-none tracking-[-2px]">
          Belum ada
          <br />
          panggilan
        </span>
      </div>
      <div className="relative flex items-center gap-3 border-t border-[#FFFFFF33] pt-5 font-body text-[22px] text-[#BFDBFE]">
        <Ticket size={24} aria-hidden className="shrink-0 text-bp-sky" />
        Siapkan struk antrean Anda
      </div>
    </>
  );
}

export function DisplayCallPanel({ call, offline }: { call: QueueCall | null; offline: boolean }) {
  return (
    <section
      aria-live="polite"
      className="relative flex flex-1 flex-col justify-between overflow-hidden bg-bp-navy px-10 py-9 text-white"
    >
      <div aria-hidden className="absolute left-[300px] top-[-200px] size-[560px] rounded-full border border-[#93C5FD4D]" />
      <div aria-hidden className="absolute left-[440px] top-[-60px] size-[280px] rounded-full border border-[#93C5FD33]" />
      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-2.5 font-caption text-[15px] tracking-[1.8px]">
          <span className={`size-2.5 rounded-full ${offline ? "bg-bp-faint" : "bg-[#4ADE80]"}`} />
          {call ? HEADER[call.status] : "MENUNGGU PANGGILAN"}
        </span>
        {call && (
          <span className="border border-bp-sky px-3 py-1.5 font-caption text-[13px] uppercase text-bp-sky">
            {call.serviceLabel}
          </span>
        )}
      </div>
      {call ? <CurrentCall call={call} /> : <WaitingForCall />}
    </section>
  );
}
