import type { RowDataPacket } from "mysql2/promise";
import { directMoveCounter, directSetPanggil, directSimpanNoRm, MLITE_DIRECT_DB, type MliteType } from "./mlite-direct";
import { getSimrsPool } from "./simrs";

// Same endpoints the mLITE pemanggil pages use (anjungan/setpanggil, anjungan/simpannorm).
// `type` is what those pages send: "loket" (type Loket, A) or "cs" (type CS, B).

function anjunganUrl(endpoint: string, params: Record<string, string>) {
  const url = new URL(process.env.MLITE_GENERAL_PATIENT_URL ?? "");
  if (!/\/anjungan\/pasien\/?$/.test(url.pathname)) throw new Error("MLITE_NOT_CONFIGURED");
  url.pathname = url.pathname.replace(/\/pasien\/?$/, `/${endpoint}`);
  url.search = new URLSearchParams(params).toString();
  return url;
}

async function callAnjungan(endpoint: string, params: Record<string, string>) {
  const response = await fetch(anjunganUrl(endpoint, params), { signal: AbortSignal.timeout(10_000) });
  if (!response.ok || response.redirected) throw new Error("MLITE_REQUEST_FAILED");
  return response;
}

/** setpanggil / simpannorm answer `{ status, message }`; a false status carries mLITE's reason ("Gagal! ..."). */
async function callAnjunganJson(endpoint: string, params: Record<string, string>) {
  const result = await (await callAnjungan(endpoint, params)).json().catch(() => null);
  if (result?.status !== true) throw new Error(result?.message || "MLITE_REQUEST_FAILED");
}

/**
 * Mirrors mLITE pemanggil pages (plugins/anjungan Admin.php show=panggil_loket / panggil_cs):
 * a new call first closes the previous number (end_time) and moves the counter (mlite_settings panggil_loket_nomor)
 * to this number, then setpanggil sets status 1 + loket so mLITE's own display can announce it.
 * A recall is only the bullhorn button: setpanggil again.
 */
export async function callMliteLoket(noantrian: string, type: MliteType, loket: number, recall: boolean) {
  if (MLITE_DIRECT_DB) {
    if (!recall) await directMoveCounter(getSimrsPool(), type, noantrian, loket);
    return directSetPanggil(getSimrsPool(), type, noantrian, loket);
  }
  const counter = String(loket);
  const show = `panggil_${type}`;
  if (!recall) {
    await callAnjungan("loket", { show, loket: counter });
    await callAnjungan("loket", { show, antrian: noantrian, reset: counter });
  }
  await callAnjunganJson("setpanggil", { noantrian, type, loket: counter });
}

/** simpannorm only accepts a 6-character RM; verified by reading the row back by its kd. */
export async function saveMliteRm(kd: number, noantrian: string, type: MliteType, noRkmMedis: string) {
  if (MLITE_DIRECT_DB) await directSimpanNoRm(getSimrsPool(), type, noantrian, noRkmMedis);
  else await callAnjunganJson("simpannorm", { noantrian, type, no_rkm_medis: noRkmMedis });
  const [rows] = await getSimrsPool().query<RowDataPacket[]>(
    "SELECT no_rkm_medis FROM mlite_antrian_loket WHERE kd = ?",
    [kd],
  );
  if (rows[0]?.no_rkm_medis !== noRkmMedis) throw new Error("MLITE_RM_NOT_SAVED");
}

export type MliteQueueTimes = { startTime: string; endTime: string | null };

/** Read-only: start_time / end_time per mlite_antrian_loket kd. end_time '00:00:00' = not closed yet. */
export async function getMliteQueueTimes(kds: number[]) {
  const times = new Map<number, MliteQueueTimes>();
  if (kds.length === 0) return times;
  const [rows] = await getSimrsPool().query<RowDataPacket[]>(
    "SELECT kd, TIME_FORMAT(start_time, '%H:%i') AS start_time, TIME_FORMAT(end_time, '%H:%i:%s') AS end_time FROM mlite_antrian_loket WHERE kd IN (?)",
    [kds],
  );
  for (const row of rows) {
    const endTime = row.end_time && row.end_time !== "00:00:00" ? String(row.end_time).slice(0, 5) : null;
    times.set(Number(row.kd), { startTime: String(row.start_time), endTime });
  }
  return times;
}
