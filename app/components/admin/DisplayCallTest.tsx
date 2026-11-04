import { useState } from "react";
import { Button } from "~/components/ui/button";
import { getSavedLoket } from "~/lib/admin-loket";
import { testPatientCallAction, testPoliCallAction } from "~/server/actions/dashboard-settings";

/** Plays a sample call on every open TV: `loket` → /display (A001 to the petugas' own loket), `poli` → /display-poli. */
export function DisplayCallTest({ token, target = "loket" }: { token: string; target?: "loket" | "poli" }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    setSending(true);
    setSent(false);
    try {
      if (target === "poli") await testPoliCallAction({ data: { token } });
      else await testPatientCallAction({ data: { token, loket: getSavedLoket() } });
      setSent(true);
    } catch {
      alert("Tes panggilan gagal dikirim. Coba lagi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border p-4">
      <div>
        <p className="font-medium text-gray-800">{target === "poli" ? "Tes panggilan poli di TV" : "Tes panggilan pasien di TV"}</p>
        {target === "poli" ? (
          <p className="text-sm text-gray-500">
            Memutar contoh panggilan "PU001 · Tes Panggilan · Poli Umum" di layar <code>/display-poli</code>: bel, overlay, suara 2×.
            Tidak tercatat di riwayat poli maupun SIMRS.
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            Memutar contoh panggilan "A001 · Tes Panggilan" ke loket Anda (Loket saya) di layar <code>/display</code>: bel, overlay, suara 2×.
            Tidak tercatat di antrean maupun mLITE.
          </p>
        )}
        {sent && <p className="mt-1 text-sm text-gray-500">Terkirim. Layar TV memutar panggilan dalam ±2 detik.</p>}
      </div>
      <Button type="button" size="sm" variant="outline" disabled={sending} onClick={send} className="shrink-0">
        {target === "poli" ? "🔊 Tes panggilan poli" : "🔊 Tes panggilan di TV"}
      </Button>
    </div>
  );
}
