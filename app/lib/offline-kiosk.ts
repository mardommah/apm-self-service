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
const DEVICE_KEY = "kiosk2_device";

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

/**
 * Device code 1–99 in offline numbers ("O1-001"), so two kiosks offline at once never print the same number.
 * Set once per device by opening /kiosk2?device=N; until then a random code is picked and kept.
 */
function deviceCode() {
  const fromUrl = Number(new URLSearchParams(window.location.search).get("device"));
  const stored = Number(localStorage.getItem(DEVICE_KEY));
  const code = [fromUrl, stored].find((n) => Number.isInteger(n) && n >= 1 && n <= 99) ?? 1 + Math.floor(Math.random() * 99);
  if (code !== stored) localStorage.setItem(DEVICE_KEY, String(code));
  return code;
}

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
    queueNumber: `O${deviceCode()}-${String(n).padStart(3, "0")}`,
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
