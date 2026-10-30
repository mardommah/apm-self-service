import { useCallback, useEffect, useState } from "react";
import { callVisitAction } from "~/server/actions/display";
import { callLoketAction, getLoketCallerAction, saveRmAction, type LoketCallerState } from "~/server/actions/loket-caller";
import { LoketCallerCard } from "./LoketCallerCard";

const ERRORS: Record<string, string> = {
  QUEUE_EMPTY: "Tidak ada antrian menunggu.",
  NUMBER_NOT_FOUND: "Nomor antrian tidak ditemukan hari ini.",
  RM_INVALID: "No RM harus 6 digit, contoh 059891.",
  VISIT_NOT_IN_MLITE: "Tiket ini tidak tercatat di mLITE, No RM tidak bisa disimpan.",
  MLITE_RM_NOT_SAVED: "mLITE tidak menyimpan No RM. Coba lagi.",
};

/** Pemanggil Pasien BPJS & Umum (mLITE Loket, A) dan Customer Service (mLITE CS, B), mirip halaman pemanggil mLITE. */
export function LoketCaller({ token, loket, onChange }: { token: string; loket: number; onChange: () => void }) {
  const [cards, setCards] = useState<LoketCallerState>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(() => getLoketCallerAction({ data: { token } }).then(setCards).catch(() => {}), [token]);
  useEffect(() => {
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  async function run(action: () => Promise<{ mliteOk?: boolean } | unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const result = (await action()) as { mliteOk?: boolean } | undefined;
      if (result?.mliteOk === false) setMessage("Dipanggil di display, tapi status di mLITE gagal diperbarui.");
      await load();
      onChange();
      return true;
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage(ERRORS[code] ?? (code.startsWith("Gagal") ? code : "Gagal. Coba lagi."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold text-gray-800">Pemanggil Loket {loket}</h2>
      {message && <p role="status" className="mb-3 text-sm text-red-600">{message}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <LoketCallerCard
            key={card.serviceCode}
            card={card}
            busy={busy}
            onCall={async (number) => {
              await run(() => callLoketAction({ data: { token, serviceCode: card.serviceCode, loket, number } }));
            }}
            onRecall={async (visitId) => {
              await run(() => callVisitAction({ data: { token, visitId, loket } }));
            }}
            onSaveRm={(visitId, noRkmMedis) => run(() => saveRmAction({ data: { token, visitId, noRkmMedis } }))}
          />
        ))}
      </div>
    </section>
  );
}
