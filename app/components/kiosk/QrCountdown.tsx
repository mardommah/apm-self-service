interface Props {
  secondsLeft: number;
  timeoutMs: number;
}

export function QrCountdown({ secondsLeft, timeoutMs }: Props) {
  const progress = (secondsLeft / Math.floor(timeoutMs / 1000)) * 100;
  return (
    <div className="w-full max-w-sm">
      <div className="flex justify-between text-sm text-gray-500 mb-2">
        <span>Halaman akan kembali otomatis</span>
        <span className={secondsLeft <= 30 ? "text-red-500 font-bold" : ""}>
          {secondsLeft}s
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
