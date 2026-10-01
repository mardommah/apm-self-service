import { useState } from "react";
import { printGeneralLoketQueue } from "~/lib/print";
import { kioskAction } from "~/server/actions/kiosk";

type Queue = { number: string; loket: 1 | 2 };
type QueueResult = { ok: true; queue: Queue } | { ok: false; message: string };

export function GeneralLoketQueue({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState("");

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
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setQueue(result.queue);
      print(result.queue);
    } catch {
      setError("Layanan antrian loket tidak dapat dihubungi. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h3 className="text-3xl font-bold text-gray-900">Antrian Loket Pasien Baru</h3>
      <p className="text-lg text-gray-600">Pilih loket pendaftaran. Nomor antrian dicetak otomatis.</p>
      {queue ? (
        <div className="w-full rounded-3xl border-2 border-green-300 bg-green-50 p-8">
          <p className="text-lg font-semibold text-green-800">Nomor antrian Anda</p>
          <strong className="block py-4 text-7xl text-green-900">{queue.number}</strong>
          <p className="text-lg">Loket Pendaftaran {queue.loket}</p>
          <button type="button" onClick={() => print(queue)} className="mt-6 rounded-xl bg-green-700 px-8 py-4 text-xl font-bold text-white">
            Cetak Ulang
          </button>
        </div>
      ) : (
        <div className="grid w-full gap-5 sm:grid-cols-2">
          {([1, 2] as const).map((loket) => (
            <button key={loket} type="button" disabled={loading} onClick={() => void takeQueue(loket)}
              className={`rounded-3xl p-10 text-2xl font-bold text-white shadow-lg disabled:opacity-50 ${loket === 1 ? "bg-green-700" : "bg-sky-700"}`}>
              {loading ? "Memproses..." : `Cetak Antrian Loket ${loket}`}
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 font-semibold text-red-700">{error}</p>}
      <button type="button" onClick={onBack} disabled={loading}
        className="rounded-xl border-2 border-blue-700 px-8 py-3 font-bold text-blue-700 disabled:opacity-50">
        Kembali
      </button>
    </div>
  );
}
