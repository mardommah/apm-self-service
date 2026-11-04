import type { KamarRow } from "~/server/functions/display-kamar";

export function DisplayBedSummary({ kamar, lastOk }: { kamar: KamarRow[]; lastOk: string | null }) {
  const total = kamar.reduce((n, k) => n + k.kapasitas, 0);
  const terisi = kamar.reduce((n, k) => n + k.terisi, 0);
  const kosong = total - terisi;
  const persen = total ? Math.round((terisi / total) * 100) : 0;
  return (
    <section className="relative flex flex-1 flex-col justify-between overflow-hidden bg-bp-navy px-10 py-9">
      <div aria-hidden className="absolute left-[300px] top-[-200px] size-[560px] rounded-full border border-[#93C5FD4D]" />
      <div aria-hidden className="absolute left-[440px] top-[-60px] size-[280px] rounded-full border border-[#93C5FD33]" />
      <div className="relative flex items-center justify-between">
        <span className="font-caption text-[22px] font-bold tracking-[1.4px] text-bp-sky">KAMAR RAWAT INAP</span>
        <span className="flex items-center gap-2.5 border border-[#FFFFFF4D] px-3 py-1.5 font-caption text-lg text-white">
          <span aria-hidden className={`size-2.5 rounded-full ${lastOk ? "bg-bp-faint" : "bg-[#4ADE80]"}`} />
          {lastOk ? `TERAKHIR ${lastOk}` : "REALTIME"}
        </span>
      </div>
      <div className="relative flex flex-col gap-1.5">
        <span className="font-caption text-[22px] font-bold tracking-[1.4px] text-[#BFDBFE]">TEMPAT TIDUR TERSEDIA</span>
        <div className="flex items-end gap-4 font-display font-medium tabular-nums">
          <span className="text-[168px] leading-none tracking-[-6px] text-white">{kosong}</span>
          <span className="text-[44px] text-bp-sky">/ {total} bed</span>
        </div>
      </div>
      <div className="relative flex flex-col gap-3.5 border-t border-[#FFFFFF33] pt-5">
        {total > 24 ? (
          <div className="h-2.5 bg-[#FFFFFF26]">
            <div className="h-full bg-bp-sky" style={{ width: `${(terisi / total) * 100}%` }} />
          </div>
        ) : (
          <div className="flex h-2.5 gap-1">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={`flex-1 ${i < terisi ? "bg-bp-sky" : "bg-[#FFFFFF26]"}`} />
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="font-body text-xl font-medium text-white">
            {total > 0 && kosong === 0 ? "Semua tempat tidur terisi" : `${terisi} terisi · okupansi ${persen}%`}
          </span>
          <span className="font-caption text-[13px] text-[#BFDBFE]">{kamar.length} KELAS KAMAR</span>
        </div>
      </div>
    </section>
  );
}
