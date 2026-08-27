import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  checkBpjsBiometric,
  createFristaJob,
  getBpjsWorkflow,
  identifyBpjsPatient,
} from "~/server/functions/bpjs";
// import { checkInBpjsPatient } from "~/server/functions/bpjs"; // DISABLED: Fitur check-in/SEP disembunyikan
import type { BpjsWorkflow } from "~/server/schema";

type ActionInput =
  | { action: "get"; visitId: string }
  | { action: "identify"; visitId: string; cardNumber: string; nik: string }
  | { action: "frista"; visitId: string; cardNumber: string }
  | { action: "biometric"; visitId: string };
  // | { action: "checkin"; visitId: string }; // DISABLED: Fitur check-in/SEP disembunyikan

const bpjsAction = createServerFn({ method: "POST" })
  .validator((data: ActionInput) => data)
  .handler(async ({ data }) => {
    if (getCookie("bpjs_kiosk_visit_id") !== data.visitId) {
      throw new Error("VISIT_DEVICE_MISMATCH");
    }
    switch (data.action) {
      case "get": return getBpjsWorkflow(data.visitId);
      case "identify": return identifyBpjsPatient(data.visitId, data);
      case "frista": return createFristaJob(data.visitId, data.cardNumber);
      case "biometric": return checkBpjsBiometric(data.visitId);
      // case "checkin": return checkInBpjsPatient(data.visitId); // DISABLED: Fitur check-in/SEP disembunyikan
    }
  });

const messages: Record<string, string> = {
  BPJS_CARD_INVALID: "Nomor kartu BPJS harus tepat 13 digit.",
  NIK_INVALID: "NIK harus tepat 16 digit.",
  MLITE_NOT_CONFIGURED: "Integrasi mLITE belum dikonfigurasi.",
  MLITE_UNAVAILABLE: "mLITE/BPJS tidak dapat dihubungi. Belum ada check-in yang dibuat.",
  MLITE_REQUEST_FAILED: "mLITE menolak permintaan. Hubungi petugas.",
  FRISTA_AGENT_NOT_CONFIGURED: "Agent Frista belum dikonfigurasi pada kiosk.",
  BIOMETRIC_NOT_VERIFIED: "Verifikasi wajah belum dikonfirmasi BPJS.",
  PATIENT_MISMATCH: "Nomor kartu tidak cocok dengan sesi pasien.",
  VISIT_DEVICE_MISMATCH: "Sesi ini bukan milik perangkat Anda atau sudah tidak aktif.",
};

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  return messages[code] ?? `Proses gagal (${code}). Hubungi petugas.`;
}

export function BpjsCheckin({
  visitId,
  patientStatus,
  destinationLabel,
  initialWorkflow,
}: {
  visitId: string;
  patientStatus: "baru" | "lama" | null;
  destinationLabel: string | null;
  initialWorkflow: BpjsWorkflow | null;
}) {
  const [cardNumber, setCardNumber] = useState("");
  const [nik, setNik] = useState("");
  const [workflow, setWorkflow] = useState<BpjsWorkflow | null>(initialWorkflow);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run<T>(task: () => Promise<T>) {
    setBusy(true);
    setError("");
    try { return await task(); }
    catch (cause) { setError(errorMessage(cause)); return null; }
    finally { setBusy(false); }
  }

  async function identify() {
    const result = await run(() => bpjsAction({
      data: { action: "identify", visitId, cardNumber, nik },
    }));
    if (result && "state" in result) setWorkflow(result as BpjsWorkflow);
  }

  async function startFrista() {
    const job = await run(() => bpjsAction({
      data: { action: "frista", visitId, cardNumber },
    }));
    if (!job || !("agentUrl" in job)) return;
    const response = await run(() => fetch(`${job.agentUrl}/jobs/frista`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: job.token, cardNumber }),
    }));
    if (!response) return;
    if (!response.ok) {
      setError("Agent Frista gagal menjalankan aplikasi. Periksa service, kamera, dan Frista.");
      return;
    }

    for (let attempt = 0; attempt < 15; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
      const checked = await run(() => bpjsAction({ data: { action: "biometric", visitId } }));
      if (checked && "state" in checked) {
        setWorkflow(checked as BpjsWorkflow);
        if ((checked as BpjsWorkflow).state === "biometric_verified") return;
      }
    }
    setError("Frista selesai, tetapi BPJS belum mengonfirmasi wajah. Coba lagi atau hubungi petugas.");
  }

  // DISABLED: Fitur check-in/SEP disembunyikan
  // async function checkIn() {
  //   const result = await run(() => bpjsAction({ data: { action: "checkin", visitId } }));
  //   if (result && "state" in result) setWorkflow(result as BpjsWorkflow);
  // }

  // State complete hanya sampai biometric_verified, tidak lanjut ke check-in/SEP
  const complete = workflow && ["biometric_verified"].includes(workflow.state);

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8">
      <section className="mx-auto max-w-xl rounded-3xl bg-white p-6 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">Check-in BPJS</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Registrasi pasien {patientStatus ?? ""}</h1>
        <p className="mt-1 text-slate-600">Tujuan: {destinationLabel ?? "Poliklinik"}</p>

        {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

        {!workflow || workflow.state === "created" ? (
          <div className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="bpjs-card">Nomor kartu BPJS</Label>
              <Input id="bpjs-card" inputMode="numeric" maxLength={13} value={cardNumber}
                onChange={(event) => setCardNumber(event.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nik">NIK</Label>
              <Input id="nik" inputMode="numeric" maxLength={16} value={nik}
                onChange={(event) => setNik(event.target.value.replace(/\D/g, ""))} />
            </div>
            <Button size="lg" disabled={busy} onClick={identify}>Verifikasi pasien BPJS</Button>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border bg-slate-50 p-4">
              <p className="font-bold text-slate-900">{workflow.patientName ?? "Pasien BPJS"}</p>
              <p className="text-sm text-slate-600">No. RM: {workflow.noRm ?? "-"}</p>
              <p className="text-sm text-slate-600">Kartu: •••••••••{workflow.cardLast4}</p>
            </div>

            {workflow.state === "biometric_required" || workflow.state === "frista_running" ? (
              <div className="space-y-3 text-center">
                <p className="font-semibold text-amber-700">BPJS mewajibkan verifikasi wajah Frista.</p>
                <p className="text-sm text-slate-600">Hadapkan wajah ke kamera kiosk, lalu tekan tombol berikut.</p>
                <Button size="lg" disabled={busy} onClick={startFrista} className="w-full">Mulai Frista</Button>
              </div>
            ) : null}

            {/* DISABLED: Fitur check-in/SEP disembunyikan
            {["patient_verified", "biometric_verified"].includes(workflow.state) && (
              <Button size="lg" disabled={busy} onClick={checkIn} className="w-full">Check-in dan buat SEP</Button>
            )}
            */}

            {/* Tampilkan pesan sukses setelah biometric verified */}
            {complete && (
              <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-5 text-center">
                <h2 className="text-xl font-bold text-green-800">Verifikasi Berhasil</h2>
                <p className="mt-2 text-green-700">Pasien telah terverifikasi BPJS.</p>
                <p className="text-sm text-green-600 mt-2">Silakan lanjutkan ke loket pendaftaran untuk proses selanjutnya.</p>
                <Button className="mt-4 w-full" onClick={() => window.print()}>Cetak bukti</Button>
              </div>
            )}
          </div>
        )}

        <a href="/" className="mt-6 block text-center font-semibold text-slate-600">← Kembali ke home</a>
      </section>
    </main>
  );
}
