type TouchKeyboardProps = {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
  mode?: "numeric" | "alphanumeric";
};

const numericRow = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
const alphanumericRows = [
  numericRow,
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["Z", "X", "C", "V", "B", "N", "M", "-"],
];

export function TouchKeyboard({
  value,
  onChange,
  maxLength = 100,
  disabled = false,
  mode = "alphanumeric",
}: TouchKeyboardProps) {
  const keyRows = mode === "numeric" ? [numericRow] : alphanumericRows;
  function append(key: string) {
    if (value.length < maxLength) onChange(value + key);
  }

  return (
    <div className="mt-4 grid gap-2" aria-label="Keyboard layar">
      {keyRows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1.5 sm:gap-2">
          {row.map((key) => (
            <button
              key={key}
              type="button"
              disabled={disabled || value.length >= maxLength}
              onClick={() => append(key)}
              className="grid min-h-12 min-w-0 flex-1 place-items-center rounded-lg border border-gray-300 bg-gray-50 px-1 text-base font-bold text-gray-800 shadow-sm active:scale-95 active:bg-blue-100 disabled:opacity-40 sm:min-h-14 sm:text-lg"
              aria-label={`Ketik ${key}`}
            >
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={() => onChange(value.slice(0, -1))}
          className="min-h-12 rounded-lg border border-amber-300 bg-amber-50 px-4 font-bold text-amber-900 active:scale-[0.98] disabled:opacity-40"
        >
          Hapus
        </button>
        <button
          type="button"
          disabled={disabled || value.length === 0}
          onClick={() => onChange("")}
          className="min-h-12 rounded-lg border border-red-300 bg-red-50 px-4 font-bold text-red-800 active:scale-[0.98] disabled:opacity-40"
        >
          Bersihkan
        </button>
      </div>
    </div>
  );
}
