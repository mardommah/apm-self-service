import * as Toast from "@radix-ui/react-toast";
import { useCallback, useEffect, useRef, useState } from "react";
import { serveAction } from "~/server/actions/dashboard-visits";
import { callVisitAction, finishVisitAction } from "~/server/actions/display";
import { callLoketAction, getLoketCallerAction, saveRmAction, type LoketCallerState } from "~/server/actions/loket-caller";
import { LoketCallerCard } from "./LoketCallerCard";

const ERRORS: Record<string, string> = {
  QUEUE_EMPTY: "Tidak ada antrian menunggu.",
  NUMBER_NOT_FOUND: "Nomor antrian tidak ditemukan hari ini.",
  RM_INVALID: "No RM harus 6 digit, contoh 059891.",
  VISIT_NOT_IN_MLITE: "Tiket ini tidak tercatat di mLITE, No RM tidak bisa disimpan.",
  MLITE_RM_NOT_SAVED: "mLITE tidak menyimpan No RM. Coba lagi.",
  VISIT_NOT_WAITING: "Tiket ini sudah dilayani atau dibatalkan.",
  VISIT_REVOKED: "Tiket ini sudah dibatalkan.",
  CALL_NOT_FOUND: "Tiket ini belum pernah dipanggil.",
  LOCK_BUSY: "Loket lain sedang memanggil. Coba lagi.",
};

/** Pemanggil Pasien BPJS & Umum (mLITE Loket, A) dan Customer Service (mLITE CS, B), mirip halaman pemanggil mLITE. */
export function LoketCaller({ token, loket, onChange }: { token: string; loket: number; onChange: () => void }) {
  const [cards, setCards] = useState<LoketCallerState>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  // Newest waiting ticket per service seen so far; undefined until the first poll seeds it.
  const seenNewest = useRef<Record<string, string | null> | undefined>(undefined);

  const load = useCallback(
    () =>
      getLoketCallerAction({ data: { token } })
        .then((next) => {
          const seen = seenNewest.current;
          if (seen) {
            const arrived = next.filter((c) => c.newest && c.newest.id !== seen[c.serviceCode]);
            if (arrived.length)
              setToasts((t) => [...t, ...arrived.map((c) => ({ id: c.newest!.id, text: `${c.label}: ${c.newest!.queueNumber}` }))]);
          }
          seenNewest.current = Object.fromEntries(next.map((c) => [c.serviceCode, c.newest?.id ?? null]));
          setCards(next);
        })
        .catch(() => {}),
    [token],
  );
  useEffect(() => {
    load();
    const id = setInterval(() => !document.hidden && load(), 5_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
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
    <Toast.Provider duration={6000} label="Notifikasi antrean">
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
              onServe={async (visitId) => {
                await run(async () => {
                  const result = await serveAction({ data: { token, visitId } });
                  // markServed reports instead of throwing when another loket already served / revoked it.
                  if (!result.success) throw new Error(result.reason === "REVOKED" ? "VISIT_REVOKED" : "VISIT_NOT_WAITING");
                });
              }}
              onFinish={async (visitId) => {
                await run(() => finishVisitAction({ data: { token, visitId } }));
              }}
            />
          ))}
        </div>
      </section>
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          onOpenChange={(open) => !open && setToasts((all) => all.filter((x) => x.id !== t.id))}
          className="rounded-lg border border-amber-200 bg-white p-3 shadow-lg"
        >
          <Toast.Title className="text-sm font-semibold text-gray-800">🔔 Antrean baru masuk</Toast.Title>
          <Toast.Description className="font-mono text-lg font-bold text-gray-900">{t.text}</Toast.Description>
        </Toast.Root>
      ))}
      <Toast.Viewport className="fixed bottom-4 right-4 z-50 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 outline-none" />
    </Toast.Provider>
  );
}
