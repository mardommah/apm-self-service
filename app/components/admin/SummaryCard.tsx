const colors: Record<string, string> = {
  blue: "bg-blue-50 border-blue-200 text-blue-800",
  amber: "bg-amber-50 border-amber-200 text-amber-800",
  green: "bg-green-50 border-green-200 text-green-800",
  red: "bg-red-50 border-red-200 text-red-800",
};

interface Props {
  label: string;
  value: number;
  color: string;
  icon: string;
}

export function SummaryCard({ label, value, color, icon }: Props) {
  return (
    <div className={`rounded-xl border p-4 text-center ${colors[color]}`}>
      <div className="text-2xl mb-1" role="img" aria-hidden>
        {icon}
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1 opacity-80">{label}</div>
    </div>
  );
}
