import { ArrowRight } from "lucide-react";
import { serviceIcon } from "~/components/kiosk/serviceIcons";

interface Props {
  code: string;
  label: string;
  index: number;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "row";
  subtitle?: string;
}

const BASE =
  "select-none text-left transition-[scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-50 enabled:active:scale-[0.96]";
const num = (n: number) => String(n).padStart(2, "0");

export function ServiceCard({ code, label, index, onClick, disabled, variant = "row", subtitle }: Props) {
  if (variant === "primary") {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={`Pilih layanan ${label}`}
        className={`${BASE} flex w-full flex-col justify-between gap-6 bg-bp-accent p-7 text-white focus-visible:outline-white enabled:hover:bg-bp-accent-ink lg:w-80`}
      >
        <div className="flex items-center justify-between">
          <span className="font-data text-[15px] font-medium">{num(index)}</span>
          <span className="border border-white px-[9px] py-[5px] font-caption text-[11px] uppercase tracking-[1.2px]">
            Alur utama
          </span>
        </div>
        <div className="flex flex-col gap-4">
          <div className="size-28 bg-white p-3.5">
            <img src="/logo bpjs.png" alt="Logo BPJS Kesehatan" className="size-full object-contain" />
          </div>
          <span className="font-display text-[44px] font-medium leading-none tracking-[-1.2px]">{label}</span>
          {subtitle && <span className="font-body text-[17px]">{subtitle}</span>}
        </div>
        <div className="flex items-center justify-between bg-white px-[18px] py-4 text-bp-accent-ink">
          <span className="font-caption text-sm uppercase tracking-[1.2px]">Mulai</span>
          <ArrowRight size={22} aria-hidden />
        </div>
      </button>
    );
  }

  const Icon = serviceIcon(code);
  const igd = code === "igd";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={`Pilih layanan ${label}`}
      className={`${BASE} flex min-h-[72px] w-full flex-1 items-center gap-5 border py-2 pl-5 pr-6 ${
        igd
          ? "border-bp-navy bg-bp-navy text-white focus-visible:outline-white"
          : "border-bp-ink bg-bp-surface text-bp-ink focus-visible:outline-bp-accent enabled:hover:bg-bp-surface-2"
      }`}
    >
      <span
        className={`grid size-[72px] shrink-0 place-items-center border ${
          igd ? "border-bp-sky text-bp-sky" : "border-bp-ink"
        }`}
      >
        <Icon size={32} strokeWidth={1.5} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className={`font-data text-[13px] font-medium ${igd ? "text-bp-sky" : "text-bp-muted"}`}>
          {num(index)}
        </span>
        <span className="font-display text-[32px] font-medium leading-none tracking-[-0.8px]">{label}</span>
      </span>
      <ArrowRight size={28} aria-hidden />
    </button>
  );
}
