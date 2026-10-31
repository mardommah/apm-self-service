import type { CallStatus, QueueCall } from "~/server/functions/calls";
import { DISPLAY_DEFAULT_LOKETS } from "./displayConfig";

// Row look per call status (DESIGN.md §9.4): DIPANGGIL blue, SEDANG DILAYANI white, SELESAI DILAYANI grey.
const STATUS = {
  called: { label: "DIPANGGIL", row: "bg-bp-accent-ink", dot: "bg-bp-sky", status: "text-[#BFDBFE]", loket: "text-white", service: "text-[#BFDBFE]", number: "text-white" },
  serving: { label: "SEDANG DILAYANI", row: "", dot: "bg-[#16A34A]", status: "text-bp-muted", loket: "text-bp-ink", service: "text-bp-muted", number: "text-bp-ink" },
  finished: { label: "SELESAI DILAYANI", row: "bg-bp-surface-2", dot: "bg-bp-faint", status: "text-bp-muted", loket: "text-bp-ink", service: "text-bp-muted", number: "text-bp-muted" },
} satisfies Record<CallStatus, Record<string, string>>;

function LoketRow({ call, flash }: { call: QueueCall; flash: boolean }) {
  const s = STATUS[call.status];
  return (
    <div
      className={`flex h-[72px] items-center gap-[18px] border-b border-bp-border px-4 ${s.row} ${
        flash ? "animate-[display-flash_300ms_2]" : ""
      }`}
    >
      <div className="flex w-[156px] shrink-0 flex-col gap-[7px]">
        <span className={`font-caption text-sm ${s.loket}`}>LOKET {String(call.loket).padStart(2, "0")}</span>
        <span className={`flex items-center gap-[7px] font-caption text-[11px] tracking-[1px] ${s.status}`}>
          <span aria-hidden className={`size-[7px] rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </div>
      <span className={`flex-1 truncate font-body text-[19px] ${s.service}`}>{call.serviceLabel}</span>
      <span className={`font-display text-4xl font-medium tracking-[-1px] tabular-nums ${s.number}`}>
        {call.queueNumber}
      </span>
    </div>
  );
}

/** Default loket with no call today yet: listed as available. */
function IdleLoketRow({ loket, queue }: { loket: number; queue: string }) {
  return (
    <div className="flex h-[72px] items-center gap-[18px] border-b border-bp-border px-4">
      <div className="flex w-[156px] shrink-0 flex-col gap-[7px]">
        <span className="font-caption text-sm text-bp-ink">LOKET {String(loket).padStart(2, "0")}</span>
        <span className="flex items-center gap-[7px] font-caption text-[11px] tracking-[1px] text-bp-muted">
          <span aria-hidden className="size-[7px] rounded-full bg-bp-faint" />
          TERSEDIA
        </span>
      </div>
      <span className="flex-1 truncate font-body text-[19px] text-bp-muted">Antrean {queue}</span>
      <span className="font-display text-4xl font-medium tracking-[-1px] text-bp-faint">–</span>
    </div>
  );
}

export function DisplayLoketList({ lokets, flashId }: { lokets: QueueCall[]; flashId?: number }) {
  // Lokets that called today, plus default lokets that have not called yet, in loket order.
  const rows = [
    ...lokets.map((call) => ({ loket: call.loket, call })),
    ...DISPLAY_DEFAULT_LOKETS.filter((d) => !lokets.some((call) => call.loket === d.loket)),
  ].sort((a, b) => a.loket - b.loket);
  return (
    <section className="flex flex-col gap-1 px-10 pb-5 pt-6">
      <div className="flex justify-between pb-2.5 font-caption text-[13px] text-bp-muted">
        <span>STATUS LOKET</span>
        <span>NOMOR DILAYANI</span>
      </div>
      {rows.map((row) =>
        "call" in row ? (
          <LoketRow key={row.loket} call={row.call} flash={row.call.id === flashId} />
        ) : (
          <IdleLoketRow key={row.loket} loket={row.loket} queue={row.queue} />
        ),
      )}
    </section>
  );
}
