import { ServiceCard } from "~/components/kiosk/ServiceCard";

interface Props {
  services: { code: string; label: string }[];
  disabled: boolean;
  bpjsDirectPrint: boolean;
  onSelect: (code: string) => void;
}

export function KioskServiceGrid({ services, disabled, bpjsDirectPrint, onSelect }: Props) {
  const primary = services.find((s) => s.code === "registrasi");
  const rows = services.filter((s) => s !== primary);
  const offset = primary ? 2 : 1;

  return (
    <div className="flex w-full flex-1 flex-col gap-5">
      <div className="flex items-center justify-between font-caption text-[13px] uppercase tracking-[1.2px]">
        <span className="text-bp-ink">FIG. 01 — Daftar layanan</span>
        <span className="text-bp-muted">{String(services.length).padStart(2, "0")} layanan</span>
      </div>
      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        {primary && (
          <ServiceCard
            variant="primary"
            code={primary.code}
            label={primary.label}
            index={1}
            disabled={disabled}
            subtitle={
              bpjsDirectPrint ? "Gunakan kartu BPJS, langsung cetak struk" : "Check-in dengan QR Mobile JKN"
            }
            onClick={() => onSelect(primary.code)}
          />
        )}
        <div className="flex flex-1 flex-col gap-3">
          {rows.map((s, i) => (
            <ServiceCard
              key={s.code}
              code={s.code}
              label={s.label}
              index={i + offset}
              disabled={disabled}
              onClick={() => onSelect(s.code)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
