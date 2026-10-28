import { Headset } from "lucide-react";

export function KioskWelcomePanel() {
  return (
    <section className="relative flex flex-col justify-between gap-7 overflow-hidden bg-bp-navy p-6 text-white lg:px-12 lg:py-11">
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        <div className="absolute left-[150px] top-[430px] size-[560px] rounded-full border border-bp-sky/30" />
        <div className="absolute left-[290px] top-[570px] size-[280px] rounded-full border border-bp-sky/20" />
        <div className="absolute inset-x-0 top-[710px] h-px bg-white/12" />
        <div className="absolute inset-y-0 left-[400px] w-px bg-white/12" />
      </div>

      <div className="relative w-fit bg-white px-3.5 py-2.5">
        <img src="/logo-klinik-s.png" alt="Klinik Syamsinar" className="h-[52px] w-[150px] object-contain" />
      </div>

      <div className="relative flex flex-col gap-7">
        <p className="font-caption text-[13px] uppercase tracking-[1.2px] text-bp-sky">
          Klinik Syamsinar Maros / Self Service
        </p>
        <h1 className="flex flex-col items-start gap-1.5 font-display text-5xl font-medium leading-none tracking-[-2.5px] lg:text-[74px]">
          <span>Pilih</span>
          <span className="border-2 border-bp-sky px-3.5 pb-2">layanan</span>
          <span>Anda.</span>
        </h1>
        <p className="font-body text-xl leading-[1.45] text-[#DBEAFE]">
          Sentuh salah satu layanan di layar untuk memulai pendaftaran.
        </p>
      </div>

      <p className="relative flex items-center gap-2.5 font-caption text-xs uppercase tracking-[1.2px] text-[#BFDBFE]">
        <Headset size={20} aria-hidden />
        Butuh bantuan? Hubungi petugas loket
      </p>
    </section>
  );
}
