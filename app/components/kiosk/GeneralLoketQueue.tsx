import { useEffect, useState } from "react";
import { printGeneralLoketQueue } from "~/lib/print";
import { kioskAction } from "~/server/actions/kiosk";

type Queue = { number: string; loket: 1 | 2 };
type QueueResult = { ok: true; queue: Queue } | { ok: false; message: string };
type Preview = { date: string; queues: Queue[] };
type PreviewResult = { ok: true; preview: Preview } | { ok: false; message: string };

export function GeneralLoketQueue({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (kioskAction({ data: { action: "general-loket-preview" } }) as Promise<PreviewResult>)
      .then((result) => {
        if (!active) return;
        if (result.ok) setPreview(result.preview);
        else setError(result.message);
      })
      .catch(() => { if (active) setError("Nomor antrian loket belum dapat dimuat."); });
    return () => { active = false; };
  }, []);

  function print(queueToPrint: Queue) {
    try {
      printGeneralLoketQueue(queueToPrint.number, queueToPrint.loket);
      setError("");
    } catch {
      setError("Nomor sudah tersimpan, tetapi cetak gagal. Tekan Cetak Ulang.");
    }
  }

  async function takeQueue(loket: 1 | 2) {
    if (loading || queue) return;
    setLoading(true);
    setError("");
    try {
      const result = await kioskAction({ data: { action: "general-loket-queue", loket } }) as QueueResult;
      if (!result.ok) { setError(result.message); return; }
      setQueue(result.queue);
      print(result.queue);
    } catch {
      setError("Layanan antrian loket tidak dapat dihubungi. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 className="text-xl font-medium">Antrian Loket</h2>
        <button type="button" onClick={onBack} disabled={loading} aria-label="Tutup antrian loket"
          className="grid h-10 w-10 place-items-center text-2xl font-bold text-gray-500 disabled:opacity-50">×</button>
      </header>
      <div className="p-4 sm:px-6 sm:py-8">
        {queue ? <div className="text-center">
          <p className="text-lg">Nomor antrian Anda</p>
          <strong className="block py-3 text-7xl font-normal">{queue.number}</strong>
          <p>Loket Pendaftaran {queue.loket}</p>
          <button type="button" onClick={() => print(queue)}
            className="mt-6 rounded bg-green-600 px-8 py-4 text-xl font-semibold text-white">Cetak Ulang</button>
        </div> : <div className="grid grid-cols-2 gap-4 sm:gap-7">
          {([1, 2] as const).map((loket) => (
            <div key={loket} className="text-center">
              <strong className="block text-6xl font-normal sm:text-8xl">
                {preview?.queues.find((item) => item.loket === loket)?.number ?? "…"}
              </strong>
              <p className="mt-2 text-sm sm:text-base">{preview ? `[${preview.date}]` : "Memuat nomor..."}</p>
              <button type="button" disabled={loading || !preview} onClick={() => void takeQueue(loket)}
                className={`mt-6 min-h-24 w-full rounded px-2 py-4 text-lg text-white disabled:opacity-50 sm:text-3xl ${loket === 1 ? "bg-green-600" : "bg-cyan-600"}`}>
                ANTRIAN LOKET {loket}
              </button>
            </div>
          ))}
        </div>}
        {error && <p role="alert" className="mt-5 rounded bg-red-50 p-3 text-center text-red-700">{error}</p>}
      </div>
      <footer className="flex justify-end border-t border-gray-200 px-5 py-4">
        <button type="button" onClick={onBack} disabled={loading}
          className="rounded bg-gray-600 px-4 py-2 text-white disabled:opacity-50">Tutup</button>
      </footer>
    </div>
  );
}
