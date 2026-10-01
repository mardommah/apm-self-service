import { useState } from "react";
import { GeneralLoketQueue } from "./GeneralLoketQueue";

type View = "select" | "queue" | "existing";

export function GeneralPatientPanel({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [view, setView] = useState<View>("select");
  const [loaded, setLoaded] = useState(false);

  if (view === "existing") return (
    <section className="fixed inset-0 z-[60] flex flex-col bg-white" aria-label="Pendaftaran pasien umum lama">
      <header className="flex items-center justify-between gap-4 bg-blue-700 px-6 py-4 text-white shadow-lg">
        <div>
          <h2 className="text-xl font-bold">Anjungan Pasien Mandiri Pelayanan Rawat Jalan</h2>
          <p className="text-sm text-blue-100">Klinik Syamsinar Maros</p>
        </div>
        <button type="button" onClick={() => setView("select")}
          className="rounded-xl bg-white px-5 py-3 font-bold text-blue-700 shadow">
          Kembali
        </button>
      </header>
      <div className="relative min-h-0 flex-1">
        {url ? <>
          {!loaded && <p className="absolute inset-0 grid place-items-center bg-white font-semibold text-blue-800">Memuat halaman anjungan...</p>}
          <iframe src={url} title="Pendaftaran pasien umum lama" onLoad={() => setLoaded(true)} className="h-full w-full border-0" />
        </> : <p role="alert" className="grid h-full place-items-center text-lg font-semibold text-red-700">
          Halaman anjungan pasien umum belum dikonfigurasi.
        </p>}
      </div>
    </section>
  );

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="presentation" onClick={view === "select" ? onClose : undefined}>
      <section role="dialog" aria-modal="true" aria-label="Pilihan pasien umum"
        onClick={(event) => event.stopPropagation()}
        className={`relative max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl ${view === "select" ? "p-5 sm:p-8" : ""}`}>
        {view === "select" && <button type="button" onClick={onClose} aria-label="Tutup pilihan pasien umum"
          className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-gray-100 text-2xl text-gray-600">
          ×
        </button>}
        {view === "select" ? <>
          <h2 className="pr-14 text-2xl font-bold text-gray-900">Pilih Jenis Pasien Umum</h2>
          <p className="mt-2 text-gray-600">Apakah pasien sudah pernah terdaftar di klinik?</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button type="button" onClick={() => setView("queue")}
              className="rounded-2xl bg-amber-400 px-6 py-8 text-2xl font-bold text-gray-950">
              Pasien Baru
            </button>
            <button type="button" onClick={() => setView("existing")}
              className="rounded-2xl bg-red-700 px-6 py-8 text-2xl font-bold text-white">
              Pasien Lama
            </button>
          </div>
        </> : <GeneralLoketQueue onBack={() => setView("select")} />}
      </section>
    </div>
  );
}
