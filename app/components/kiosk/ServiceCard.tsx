import { SERVICE_ICONS } from "~/lib/utils";

interface Props {
  code: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ServiceCard({ code, label, onClick, disabled }: Props) {
  const icon = SERVICE_ICONS[code] ?? "🏥";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-2 sm:rounded-3xl sm:p-3",
        "transition-all duration-150 select-none",
        "min-h-[clamp(7rem,18dvh,9.25rem)] w-full",
        disabled
          ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
          : "border-blue-200 bg-white hover:border-blue-500 hover:bg-blue-50 active:scale-95 cursor-pointer shadow-sm hover:shadow-md",
      ].join(" ")}
      aria-label={`Pilih layanan ${label}`}
    >
      {code === "registrasi" ? (
        <img
          src="/logo bpjs.png"
          alt="Logo BPJS Kesehatan"
          className="h-14 w-14 object-contain sm:h-18 sm:w-18"
        />
      ) : (
        <span className="text-4xl sm:text-6xl" role="img" aria-hidden>
          {icon}
        </span>
      )}
      <span className="text-sm font-bold text-gray-800 text-center leading-tight sm:text-xl">
        {label}
      </span>
    </button>
  );
}
