import { kioskAction, type KioskData } from "~/server/actions/kiosk";
import { ulid } from "~/lib/ulid";

// Kiosk 2 offline-first: tickets made while the server is unreachable wait in a
// localStorage outbox and are uploaded by syncOutbox (idempotent by visit id).
export type OfflineVisit = {
  id: string;
  serviceCode: string;
  serviceLabel: string;
  createdAt: string;
  queueNumber: string;
};

const DATA_KEY = "kiosk2_data";
const OUTBOX_KEY = "kiosk2_outbox";
const SEQ_KEY = "kiosk2_offline_seq";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function cacheKioskData(data: KioskData) {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(data));
  } catch {}
  return data;
}

export const getCachedKioskData = () => read<KioskData>(DATA_KEY);

const getOutbox = () => read<OfflineVisit[]>(OUTBOX_KEY) ?? [];

export const getOfflineVisit = (id: string) => getOutbox().find((visit) => visit.id === id) ?? null;

/** Throws when storage is unavailable so the kiosk shows an error instead of a ticket that never syncs. */
export function queueOfflineVisit(service: { code: string; label: string }): OfflineVisit {
  const day = new Date().toDateString();
  const seq = read<{ day: string; n: number }>(SEQ_KEY);
  const n = seq?.day === day ? seq.n + 1 : 1;
  const visit: OfflineVisit = {
    id: ulid(),
    serviceCode: service.code,
    serviceLabel: service.label,
    createdAt: new Date().toISOString(),
    queueNumber: `O${String(n).padStart(3, "0")}`,
  };
  localStorage.setItem(OUTBOX_KEY, JSON.stringify([...getOutbox(), visit]));
  localStorage.setItem(SEQ_KEY, JSON.stringify({ day, n }));
  return visit;
}

let syncing = false;

export async function syncOutbox() {
  const pending = getOutbox();
  if (syncing || !pending.length) return;
  syncing = true;
  try {
    const { done } = (await kioskAction({ data: { action: "sync", visits: pending } })) as { done: string[] };
    // Re-read: tickets queued while the request was in flight must stay.
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(getOutbox().filter((visit) => !done.includes(visit.id))));
  } catch {
    // Still offline; next tick retries.
  } finally {
    syncing = false;
  }
}

export function startBackgroundSync(intervalMs = 15_000) {
  void syncOutbox();
  const timer = window.setInterval(syncOutbox, intervalMs);
  window.addEventListener("online", syncOutbox);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("online", syncOutbox);
  };
}
