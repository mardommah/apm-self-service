// Services whose tickets are also rows in SIMRS mlite_antrian_loket. The prefix picks the mLITE anjungan queue:
// "A" → ANTRIAN LOKET (type Loket), "B" → ANTRIAN CS (type CS). mLITE stores only the number ("1"), the app shows "A001".
export const QUEUE_PREFIXES = ["A", "B"] as const;
export type QueuePrefix = (typeof QUEUE_PREFIXES)[number];

export const DEFAULT_QUEUE_PREFIX: Record<string, QueuePrefix> = { registrasi: "A", poli_umum: "A", customer_service: "B" };
export const MLITE_SERVICE_CODES = Object.keys(DEFAULT_QUEUE_PREFIX);

export function isQueuePrefix(value: unknown): value is QueuePrefix {
  return QUEUE_PREFIXES.includes(value as QueuePrefix);
}
