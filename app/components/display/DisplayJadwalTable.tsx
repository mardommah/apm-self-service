import { useEffect, useState } from "react";
import { CalendarX, Info } from "lucide-react";
import type { JadwalRow } from "~/server/functions/display-kamar";
import { DISPLAY_TIMEZONE } from "./displayConfig";

const PAGE_SIZE = 9;
const PAGE_MS = 15_000;

type Status = "praktik" | "terjadwal" | "selesai";

function nowHHmm() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: DISPLAY_TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
}

/** "HH:mm" strings compare correctly as text. */
export function jadwalStatus(row: JadwalRow, now: string): Status {
  if (now < row.mulai) return "terjadwal";
  return now < row.selesai ? "praktik" : "selesai";
}

function titleCase(text: string) {
  return text.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

const STYLE: Record<Status, { row: string; dot: string; no: string; name: string; poli: string; start: string; end: string; status: string; dash: string; label: string }> = {
  praktik: { row: "bg-bp-accent-ink border-bp-accent-ink", dot: "bg-[#4ADE80]", no: "text-[#BFDBFE]", name: "text-white", poli: "text-[#BFDBFE]", start: "text-white", end: "text-white", status: "text-white", dash: "bg-bp-sky", label: "SEDANG PRAKTIK" },
  terjadwal: { row: "bg-bp-surface border-bp-border", dot: "bg-bp-faint", no: "text-bp-muted", name: "text-bp-ink", poli: "text-bp-muted", start: "text-bp-ink", end: "text-bp-muted", status: "text-bp-muted", dash: "bg-bp-faint", label: "TERJADWAL" },
  selesai: { row: "bg-bp-surface-2 border-bp-border", dot: "bg-bp-faint", no: "text-bp-faint", name: "text-bp-muted", poli: "text-bp-faint", start: "text-bp-muted", end: "text-bp-faint", status: "text-bp-faint", dash: "bg-bp-faint", label: "SELESAI" },
};

function useClockMinute() {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    setNow(nowHHmm());
    const id = setInterval(() => setNow(nowHHmm()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function DisplayJadwalTable({ jadwal, error }: { jadwal: JadwalRow[] | null; error?: boolean }) {
  const now = useClockMinute();
  const [page, setPage] = useState(0);
  // Over one page: skip schedules already finished so page 1 starts at what is still relevant.
  const firstOpen = now && jadwal ? jadwal.findIndex((r) => jadwalStatus(r, now) !== "selesai") : -1;
  const rows = jadwal && jadwal.length > PAGE_SIZE && firstOpen > 0 ? jadwal.slice(firstOpen) : (jadwal ?? []);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = page % pages;

  useEffect(() => {
    if (pages <= 1) return;
    const id = setInterval(() => setPage((p) => p + 1), PAGE_MS);
    return () => clearInterval(id);
  }, [pages]);

  const poliCount = new Set(jadwal?.map((r) => r.poli)).size;
  const meta = pages > 1 ? `HAL ${current + 1} / ${pages}` : `${jadwal?.length ?? 0} JADWAL · ${poliCount} POLIKLINIK`;

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-5 pb-7 pl-10 pr-8 pt-8">
      <div className="flex items-center justify-between font-caption text-[22px] font-bold tracking-[1.4px] text-bp-ink">
        <span>JADWAL PRAKTEK DOKTER HARI INI</span>
        {jadwal && <span>{meta}</span>}
      </div>
      {!jadwal || jadwal.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 border border-bp-border bg-bp-surface text-center">
          {error ? (
            <span className="font-body text-[22px] text-bp-muted">Data SIMRS tidak dapat dimuat</span>
          ) : (
            <>
              <CalendarX size={40} aria-hidden className="text-bp-faint" />
              <span className="font-display text-[40px] font-medium text-bp-ink">Tidak ada jadwal praktek hari ini</span>
              <span className="font-body text-xl text-bp-muted">Pelayanan IGD tetap buka 24 jam.</span>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col border border-bp-border bg-bp-surface">
          <div className="flex h-[52px] items-center gap-4 border-b border-bp-border bg-bp-surface-2 px-6 font-caption text-xs tracking-[1.4px] text-bp-muted">
            <span className="w-11 shrink-0">NO</span>
            <span className="min-w-0 flex-1">NAMA DOKTER</span>
            <span className="w-[230px] shrink-0">POLIKLINIK</span>
            <span className="w-[220px] shrink-0">JAM PRAKTEK</span>
            <span className="w-[170px] shrink-0">STATUS</span>
          </div>
          <div key={current} className="flex animate-[fade_300ms_ease-out] flex-col">
            {rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE).map((row, i, list) => {
              const s = STYLE[now ? jadwalStatus(row, now) : "terjadwal"];
              const no = (jadwal.indexOf(row) + 1).toString().padStart(2, "0");
              return (
                <div key={`${row.dokter}-${row.mulai}`} className={`flex h-[76px] items-center gap-4 px-6 ${s.row} ${i < list.length - 1 ? "border-b" : ""}`}>
                  <span className={`w-11 shrink-0 font-caption text-sm ${s.no}`}>{no}</span>
                  <span className={`min-w-0 flex-1 truncate font-body text-[21px] font-medium ${s.name}`}>{row.dokter}</span>
                  <span className={`w-[230px] shrink-0 truncate font-body text-[19px] ${s.poli}`}>{titleCase(row.poli)}</span>
                  <span className="flex w-[220px] shrink-0 items-center gap-2 font-display text-[28px] font-medium tracking-[-0.5px] tabular-nums">
                    <span className={s.start}>{row.mulai}</span>
                    <span aria-label="sampai" className={`h-0.5 w-3.5 ${s.dash}`} />
                    <span className={s.end}>{row.selesai}</span>
                  </span>
                  <span className={`flex w-[170px] shrink-0 items-center gap-2 font-caption text-xs tracking-[1px] ${s.status}`}>
                    <span aria-hidden className={`size-2 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="flex items-center gap-2.5 font-body text-base text-bp-muted">
        <Info size={16} aria-hidden />
        Jadwal dapat berubah sewaktu-waktu. Konfirmasi kehadiran dokter di bagian pendaftaran.
      </p>
    </section>
  );
}
