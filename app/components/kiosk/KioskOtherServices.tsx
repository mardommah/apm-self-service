import { serviceIcon } from "~/components/kiosk/serviceIcons";

interface Props {
  services: { code: string; label: string }[];
  startIndex: number;
  disabled: boolean;
  onSelect: (code: string) => void;
}

const num = (n: number) => String(n).padStart(2, "0");

export function KioskOtherServices({ services, startIndex, disabled, onSelect }: Props) {
  if (!services.length) return null;
  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="flex items-center justify-between font-caption text-[13px] uppercase tracking-[1.2px] text-bp-muted">
        <span>Layanan lainnya</span>
        <span>{num(services.length)} layanan</span>
      </div>
      <div className="flex flex-col gap-4 sm:h-[92px] sm:flex-row">
        {services.map((s, i) => {
          const Icon = serviceIcon(s.code);
          return (
            <button
              key={s.code}
              onClick={() => onSelect(s.code)}
              disabled={disabled}
              aria-label={`Pilih layanan ${s.label}`}
              className="flex min-h-[72px] flex-1 select-none items-center gap-3.5 border border-bp-ink bg-bp-surface px-4 text-left text-bp-ink transition-[scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bp-accent disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-bp-surface-2 enabled:active:scale-[0.96]"
            >
              <span className="grid size-12 shrink-0 place-items-center border border-bp-ink">
                <Icon size={22} strokeWidth={1.5} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="font-data text-xs font-medium text-bp-muted">{num(startIndex + i)}</span>
                <span className="font-display text-[21px] font-medium leading-[1.05] tracking-[-0.4px]">
                  {s.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
