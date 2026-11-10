import { useEffect, useState } from "react";
import { CalendarX, Info } from "lucide-react";
import type { JadwalRow } from "~/server/functions/display-kamar";
import { poliLabel } from "~/lib/poli-call";
import { DISPLAY_TIMEZONE } from "./displayConfig";

// Rows are at least 76px and grow for a wrapped doctor name or a second session; from this many schedules every font is compact.
const COMPACT_FROM = 13;

type Status = "praktik" | "terjadwal" | "selesai" | "tutup" | "cuti";

function nowHHmm() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: DISPLAY_TIMEZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
}

/** "HH:mm" strings compare correctly as text. Between two sessions the doctor is "terjadwal" again (next session). */
export function jadwalStatus(row: JadwalRow, now: string): Status {
  if (row.libur) return row.libur;
  const sesi = row.sesi.filter((s) => !s.tutup);
  if (!sesi.length) return "tutup";
  if (sesi.some((s) => s.mulai <= now && now < s.selesai)) return "praktik";
  return sesi.some((s) => now < s.mulai) ? "terjadwal" : "selesai";
}

const STYLE: Record<Status, { row: string; dot: string; no: string; name: string; poli: string; start: string; end: string; status: string; dash: string; label: string }> = {
  praktik: { row: "bg-bp-accent-ink border-bp-accent-ink", dot: "bg-[#4ADE80]", no: "text-[#BFDBFE]", name: "text-white", poli: "text-[#BFDBFE]", start: "text-white", end: "text-white", status: "text-white", dash: "bg-bp-sky", label: "SEDANG PRAKTIK" },
  terjadwal: { row: "bg-bp-surface border-bp-border", dot: "bg-bp-faint", no: "text-bp-ink", name: "text-bp-ink", poli: "text-bp-ink", start: "text-bp-ink", end: "text-bp-ink", status: "text-bp-ink", dash: "bg-bp-faint", label: "TERJADWAL" },
  selesai: { row: "bg-bp-surface-2 border-bp-border", dot: "bg-bp-faint", no: "text-bp-ink", name: "text-bp-ink", poli: "text-bp-ink", start: "text-bp-ink", end: "text-bp-ink", status: "text-bp-ink", dash: "bg-bp-faint", label: "SELESAI" },
  // Marked by admin (Pengaturan → Dokter tutup/cuti); session times struck through.
  tutup: { row: "bg-bp-surface-2 border-bp-border", dot: "bg-[#DC2626]", no: "text-bp-ink", name: "text-bp-ink", poli: "text-bp-ink", start: "text-bp-ink line-through", end: "text-bp-ink line-through", status: "text-[#B91C1C]", dash: "bg-bp-faint", label: "TUTUP" },
  cuti: { row: "bg-bp-surface-2 border-bp-border", dot: "bg-[#DC2626]", no: "text-bp-ink", name: "text-bp-ink", poli: "text-bp-ink", start: "text-bp-ink line-through", end: "text-bp-ink line-through", status: "text-[#B91C1C]", dash: "bg-bp-faint", label: "CUTI" },
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
  const compact = (jadwal?.length ?? 0) >= COMPACT_FROM;
  const poliCount = new Set(jadwal?.map((r) => r.poli)).size;
  const meta = `${jadwal?.length ?? 0} JADWAL · ${poliCount} POLIKLINIK`;

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-5 pb-7 pl-10 pr-8 pt-8">
      <div className="flex items-center justify-between font-caption text-[22px] font-bold tracking-[1.4px] text-bp-ink">
        <span>JADWAL PRAKTEK DOKTER HARI INI</span>
        {jadwal && <span>{meta}</span>}
      </div>
      {!jadwal || jadwal.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 border border-bp-border bg-bp-surface text-center">
          {error ? (
            <span className="font-body text-[22px] text-bp-ink">Data SIMRS tidak dapat dimuat</span>
          ) : (
            <>
              <CalendarX size={40} aria-hidden className="text-bp-ink" />
              <span className="font-display text-[40px] font-medium text-bp-ink">Tidak ada jadwal praktek hari ini</span>
              <span className="font-body text-xl text-bp-ink">Pelayanan IGD tetap buka 24 jam.</span>
            </>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-col border border-bp-border bg-bp-surface">
          <div className="flex h-[56px] shrink-0 items-center gap-4 border-b border-bp-border bg-bp-surface-2 px-6 font-caption text-lg font-bold tracking-[1.4px] text-bp-ink">
            <span className="w-11 shrink-0">NO</span>
            <span className="min-w-0 flex-1">NAMA DOKTER</span>
            <span className="w-[230px] shrink-0">POLIKLINIK</span>
            <span className="w-[220px] shrink-0">JAM PRAKTEK</span>
            <span className="w-[250px] shrink-0">STATUS</span>
          </div>
          <div className="flex min-h-0 flex-col">
            {jadwal.map((row, i, list) => {
              const s = STYLE[now ? jadwalStatus(row, now) : "terjadwal"];
              const no = (i + 1).toString().padStart(2, "0");
              return (
                <div key={`${row.dokter}-${row.kdPoli}`} className={`flex min-h-[76px] shrink-0 items-center gap-4 px-6 py-2.5 ${s.row} ${i < list.length - 1 ? "border-b" : ""}`}>
                  <span className={`w-11 shrink-0 font-caption text-sm ${s.no}`}>{no}</span>
                  <span className={`min-w-0 flex-1 break-words font-body leading-snug ${compact ? "text-lg" : "text-[21px]"} font-medium ${s.name}`}>{row.dokter}</span>
                  <span className={`w-[230px] shrink-0 truncate font-body ${compact ? "text-base" : "text-[19px]"} ${s.poli}`}>{poliLabel(row.poli)}</span>
                  <span className={`flex w-[220px] shrink-0 flex-col justify-center gap-1 font-display font-medium leading-tight tracking-[-0.5px] tabular-nums ${compact ? "text-[22px]" : "text-[28px]"}`}>
                    {row.sesi.map((sesi) => (
                      <span key={sesi.mulai} className="flex items-center gap-2">
                        <span className={`${s.start} ${sesi.tutup ? "line-through decoration-[#DC2626] decoration-2" : ""}`}>{sesi.mulai}</span>
                        <span aria-label="sampai" className={`h-0.5 w-3.5 ${s.dash}`} />
                        <span className={`${s.end} ${sesi.tutup ? "line-through decoration-[#DC2626] decoration-2" : ""}`}>{sesi.selesai}</span>
                        {sesi.tutup && row.sesi.length > 1 && <span className="font-caption text-sm font-bold tracking-[1px] text-[#B91C1C]">TUTUP</span>}
                      </span>
                    ))}
                  </span>
                  <span className={`flex w-[250px] shrink-0 items-center gap-2.5 font-caption ${compact ? "text-[17px]" : "text-xl"} font-bold tracking-[1px] ${s.status}`}>
                    <span aria-hidden className={`size-3 shrink-0 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="flex items-center gap-2.5 font-body text-base text-bp-ink">
        <Info size={16} aria-hidden />
        Jadwal dapat berubah sewaktu-waktu. Konfirmasi kehadiran dokter di bagian pendaftaran.
      </p>
    </section>
  );
}
