import type { QueueCall } from "~/server/functions/calls";

export function DisplayLoketList({ lokets, activeId, flash }: { lokets: QueueCall[]; activeId?: number; flash: boolean }) {
  return (
    <section className="flex flex-col gap-1 px-10 pb-5 pt-6">
      <div className="flex justify-between pb-2.5 font-caption text-[13px] text-bp-muted">
        <span>FIG. 02 — STATUS LOKET</span>
        <span>NOMOR AKTIF</span>
      </div>
      {lokets.length === 0 && (
        <div className="flex h-[72px] items-center px-4 font-body text-[19px] text-bp-faint">Belum ada loket yang memanggil</div>
      )}
      {lokets.map((call) => {
        const active = call.id === activeId;
        return (
          <div
            key={call.loket}
            className={`flex h-[72px] items-center gap-[18px] border-b border-bp-border px-4 ${
              active ? (flash ? "animate-[display-flash_300ms_2] bg-bp-accent-ink" : "bg-bp-accent-ink") : ""
            }`}
          >
            <span className={`font-caption text-sm ${active ? "text-white" : "text-bp-ink"}`}>
              LOKET {String(call.loket).padStart(2, "0")}
            </span>
            <span className={`flex-1 truncate font-body text-[19px] ${active ? "text-[#BFDBFE]" : "text-bp-muted"}`}>
              {call.serviceLabel}
            </span>
            <span
              className={`font-display text-4xl font-medium tracking-[-1px] tabular-nums ${active ? "text-white" : "text-bp-ink"}`}
            >
              {call.queueNumber}
            </span>
          </div>
        );
      })}
    </section>
  );
}
