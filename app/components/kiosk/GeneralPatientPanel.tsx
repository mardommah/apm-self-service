import { useState } from "react";
import { GeneralLoketQueue } from "./GeneralLoketQueue";

type View = "select" | "queue" | "existing";

export function GeneralPatientPanel({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [view, setView] = useState<View>("select");
  const [loaded, setLoaded] = useState(false);

  return (
    <section className="fixed inset-0 z-[60] flex flex-col bg-white" aria-label="Anjungan pasien umum">
      <header className="flex items-center justify-between gap-4 bg-blue-700 px-6 py-4 text-white shadow-lg">
        <div>
          <h2 className="text-xl font-bold">Anjungan Pasien Mandiri Pelayanan Rawat Jalan</h2>
          <p className="text-sm text-blue-100">Klinik Syamsinar Maros</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-xl bg-white px-5 py-3 font-bold text-blue-700 shadow">
          Kembali ke Home
        </button>
      </header>
      {view === "select" && (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 p-6 text-center">
          <h3 className="text-3xl font-bold text-gray-900">Pilih Jenis Pasien Umum</h3>
          <div className="grid gap-5 sm:grid-cols-2">
            <button type="button" onClick={() => setView("queue")}
              className="rounded-3xl bg-amber-400 p-12 text-3xl font-bold text-gray-950 shadow-lg">
              Pasien Baru
            </button>
            <button type="button" onClick={() => setView("existing")}
              className="rounded-3xl bg-red-700 p-12 text-3xl font-bold text-white shadow-lg">
              Pasien Lama
            </button>
          </div>
        </div>
      )}
      {view === "queue" && <GeneralLoketQueue onBack={() => setView("select")} />}
      {view === "existing" && (
        <div className="relative min-h-0 flex-1">
          <button type="button" onClick={() => setView("select")}
            className="absolute right-5 top-5 z-20 rounded-xl bg-blue-700 px-6 py-3 font-bold text-white shadow-lg">
            Kembali
          </button>
          {url ? <>
            {!loaded && <p className="absolute inset-0 grid place-items-center bg-white font-semibold text-blue-800">Memuat halaman anjungan...</p>}
            <iframe src={url} title="Pendaftaran pasien umum lama" onLoad={() => setLoaded(true)} className="h-full w-full border-0" />
          </> : <p role="alert" className="grid h-full place-items-center text-lg font-semibold text-red-700">
            Halaman anjungan pasien umum belum dikonfigurasi.
          </p>}
        </div>
      )}
    </section>
  );
}
