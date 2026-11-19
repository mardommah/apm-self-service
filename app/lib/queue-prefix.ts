// Services whose new-patient tickets are also rows in SIMRS mlite_antrian_loket. The prefix only picks the mLITE queue:
// "A" → ANTRIAN LOKET (type Loket), "B" → ANTRIAN CS (type CS). The ticket itself shows SERVICE_QUEUE_LETTERS.
export const QUEUE_PREFIXES = ["A", "B"] as const;
export type QueuePrefix = (typeof QUEUE_PREFIXES)[number];

export const DEFAULT_QUEUE_PREFIX: Record<string, QueuePrefix> = { registrasi: "A", poli_umum: "A", customer_service: "B" };
export const MLITE_SERVICE_CODES = Object.keys(DEFAULT_QUEUE_PREFIX);

// Printed ticket letter per service, for new and existing patients alike (mLITE keeps its own bare number).
export const SERVICE_QUEUE_LETTERS: Record<string, string> = {
  poli_umum: "D",
  registrasi: "B",
  laboratorium: "L",
  vaksinasi: "V",
  customer_service: "C",
  surat_keterangan: "S",
  igd: "I",
  layanan_lainnya: "LL",
};
export const FALLBACK_QUEUE_LETTER = "P";

export function serviceQueueLetter(serviceCode: string) {
  return SERVICE_QUEUE_LETTERS[serviceCode] ?? FALLBACK_QUEUE_LETTER;
}

export function isQueuePrefix(value: unknown): value is QueuePrefix {
  return QUEUE_PREFIXES.includes(value as QueuePrefix);
}
