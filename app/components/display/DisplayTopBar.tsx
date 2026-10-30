import { useEffect, useState } from "react";
import { DISPLAY_TIMEZONE } from "./displayConfig";

function format(now: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: DISPLAY_TIMEZONE, ...options }).format(now).toUpperCase();
}

function useNow() {
  // First render happens on the client only, so SSR and hydration never disagree on the time.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function DisplayTopBar() {
  const now = useNow();
  return (
    <header className="flex h-[104px] shrink-0 items-center justify-between border-b border-bp-ink bg-bp-surface px-12">
      <div className="flex items-center gap-7">
        <img src="/logo-klinik-s.png" alt="Klinik Syamsinar" className="h-[58px] w-[170px] object-contain" />
        <span aria-hidden className="h-[52px] w-px bg-bp-border" />
        <div className="flex flex-col gap-1.5">
          <span className="font-caption text-[13px] tracking-[1.4px] text-bp-muted">DISPLAY ANTREAN / RUANG TUNGGU</span>
          <span className="font-display text-[28px] font-medium tracking-[-0.5px] text-bp-ink">Klinik Syamsinar Maros</span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end gap-1.5 font-caption">
          <span className="text-[13px] text-bp-muted">{now && format(now, { weekday: "long" })}</span>
          <span className="text-base text-bp-ink">
            {now && format(now, { day: "2-digit", month: "short", year: "numeric" }).replace(".", "")}
          </span>
        </div>
        <div className="flex items-end gap-2 bg-bp-navy px-[18px] py-2.5">
          <span className="font-display text-[44px] font-medium leading-none tracking-[-1px] text-white tabular-nums">
            {now ? format(now, { hour: "2-digit", minute: "2-digit", hour12: false }).replace(".", ":") : "--:--"}
          </span>
          <span className="font-caption text-xs text-bp-sky">WITA</span>
        </div>
      </div>
    </header>
  );
}
