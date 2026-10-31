import { useState } from "react";
import { Button } from "~/components/ui/button";
import { getSavedLoket } from "~/lib/admin-loket";
import { testPatientCallAction } from "~/server/actions/dashboard-settings";

/** Plays a sample patient call (A001) on every open /display, to the petugas' own loket. */
export function DisplayCallTest({ token }: { token: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    setSending(true);
    setSent(false);
    try {
      await testPatientCallAction({ data: { token, loket: getSavedLoket() } });
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
        <p className="font-medium text-gray-800">Tes panggilan pasien di TV</p>
        <p className="text-sm text-gray-500">
          Memutar contoh panggilan "A001 · Tes Panggilan" ke loket Anda (Loket saya) di layar <code>/display</code>: bel, overlay, suara 2×.
          Tidak tercatat di antrean maupun mLITE.
        </p>
        {sent && <p className="mt-1 text-sm text-gray-500">Terkirim. Layar TV memutar panggilan dalam ±2 detik.</p>}
      </div>
      <Button type="button" size="sm" variant="outline" disabled={sending} onClick={send} className="shrink-0">
        🔊 Tes panggilan di TV
      </Button>
    </div>
  );
}
