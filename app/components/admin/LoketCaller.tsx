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

/** Windows/OS notification via the browser; undefined outside a secure context (HTTPS/localhost) or during SSR. */
const osNotification = () => (typeof window !== "undefined" && "Notification" in window ? Notification : undefined);

/** Pemanggil Pasien BPJS & Umum (mLITE Loket, A) dan Customer Service (mLITE CS, B), mirip halaman pemanggil mLITE. */
export function LoketCaller({ token, loket, onChange }: { token: string; loket: number; onChange: () => void }) {
  const [cards, setCards] = useState<LoketCallerState>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);
  // Newest waiting ticket per service seen so far; undefined until the first poll seeds it.
  const seenNewest = useRef<Record<string, string | null> | undefined>(undefined);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => setNotifPerm(osNotification()?.permission ?? "unsupported"), []);
  // Tickets that arrived while the admin was not looking; blinks the tab title until the page is seen again.
  const [unseen, setUnseen] = useState(0);
  useEffect(() => {
    if (!unseen) return;
    const original = document.title;
    let on = false;
    const id = setInterval(() => {
      on = !on;
      document.title = on ? `🔔 (${unseen}) Antrean baru` : original;
    }, 1_000);
    const seen = () => !document.hidden && document.hasFocus() && setUnseen(0);
    document.addEventListener("visibilitychange", seen);
    window.addEventListener("focus", seen);
    return () => {
      clearInterval(id);
      document.title = original;
      document.removeEventListener("visibilitychange", seen);
      window.removeEventListener("focus", seen);
    };
  }, [unseen]);

  const load = useCallback(
    () =>
      getLoketCallerAction({ data: { token } })
        .then((next) => {
          const seen = seenNewest.current;
          if (seen) {
            const arrived = next.filter((c) => c.newest && c.newest.id !== seen[c.serviceCode]);
            const items = arrived.map((c) => ({ id: c.newest!.id, text: `${c.label}: ${c.newest!.queueNumber}` }));
            if (items.length) setToasts((t) => [...t, ...items]);
            const away = document.hidden || !document.hasFocus();
            if (items.length && away) setUnseen((n) => n + items.length);
            const N = osNotification();
            // OS notification only when the admin is not looking at this tab; the in-page toast covers the rest.
            if (N?.permission === "granted" && away)
              for (const item of items) {
                const n = new N("🔔 Antrean baru masuk", { body: item.text, tag: item.id });
                n.onclick = () => {
                  window.focus();
                  n.close();
                };
              }
          }
          seenNewest.current = Object.fromEntries(next.map((c) => [c.serviceCode, c.newest?.id ?? null]));
          setCards(next);
        })
        .catch(() => {}),
    [token],
  );
  useEffect(() => {
    load();
    // Keeps polling while hidden so the title blink / OS notification still fire (browser may throttle it to ~1×/min).
    const id = setInterval(load, 5_000);
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
      if (result?.mliteOk === false) setMessage("Tersimpan di aplikasi, tapi status di mLITE gagal diperbarui.");
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-800">Pemanggil Loket {loket}</h2>
          {notifPerm === "default" && (
            <button
              type="button"
              onClick={() => osNotification()?.requestPermission().then(setNotifPerm)}
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-800 hover:bg-amber-100"
            >
              🔔 Aktifkan notifikasi Windows
            </button>
          )}
          {notifPerm === "denied" && (
            <span className="text-xs text-gray-500">Notifikasi Windows diblokir browser (izinkan lewat ikon gembok di address bar).</span>
          )}
          {notifPerm === "unsupported" && (
            <span className="text-xs text-gray-500">Notifikasi Windows butuh HTTPS atau localhost.</span>
          )}
        </div>
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
