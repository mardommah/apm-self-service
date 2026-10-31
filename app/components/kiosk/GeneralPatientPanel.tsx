import { useState } from "react";
import type { PatientStatus } from "~/lib/utils";
import { GeneralLoketQueue } from "./GeneralLoketQueue";

/** Like mLITE anjungan/pasien: both new and existing general patients take a Loket 1/2 queue number. */
export function GeneralPatientPanel({ onClose }: { onClose: () => void }) {
  const [patientStatus, setPatientStatus] = useState<PatientStatus | null>(null);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
      role="presentation" onClick={patientStatus ? undefined : onClose}>
      <section role="dialog" aria-modal="true" aria-label="Pilihan pasien umum"
        onClick={(event) => event.stopPropagation()}
        className={`relative max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl ${patientStatus ? "" : "p-5 sm:p-8"}`}>
        {patientStatus ? <GeneralLoketQueue patientStatus={patientStatus} onBack={() => setPatientStatus(null)} /> : <>
          <button type="button" onClick={onClose} aria-label="Tutup pilihan pasien umum"
            className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-gray-100 text-2xl text-gray-600">
            ×
          </button>
          <h2 className="pr-14 text-2xl font-bold text-gray-900">Pilih Jenis Pasien Umum</h2>
          <p className="mt-2 text-gray-600">Apakah pasien sudah pernah terdaftar di klinik?</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button type="button" onClick={() => setPatientStatus("baru")}
              className="rounded-2xl bg-amber-400 px-6 py-8 text-2xl font-bold text-gray-950">
              Pasien Baru
            </button>
            <button type="button" onClick={() => setPatientStatus("lama")}
              className="rounded-2xl bg-red-700 px-6 py-8 text-2xl font-bold text-white">
              Pasien Lama
            </button>
          </div>
        </>}
      </section>
    </div>
  );
}
