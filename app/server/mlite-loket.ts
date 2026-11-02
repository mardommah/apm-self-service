import type { RowDataPacket } from "mysql2/promise";
import { directFinishQueue, directMoveCounter, directSetPanggil, directSimpanNoRm, type MliteType } from "./mlite-direct";
import { getSimrsPool } from "./simrs";

// `type` is what the mLITE pemanggil pages send: "loket" (type Loket, A) or "cs" (type CS, B).

/**
 * Mirrors mLITE pemanggil pages (plugins/anjungan Admin.php show=panggil_loket / panggil_cs):
 * a new call first closes the previous number (end_time) and moves the counter (mlite_settings panggil_loket_nomor)
 * to this number, then setpanggil sets status 1 + loket so mLITE's own display can announce it.
 * A recall is only the bullhorn button: setpanggil again.
 */
export async function callMliteLoket(noantrian: string, type: MliteType, loket: number, recall: boolean) {
  if (!recall) await directMoveCounter(getSimrsPool(), type, noantrian, loket);
  await directSetPanggil(getSimrsPool(), type, noantrian, loket);
}

/** "Selesai dilayani": status 2 + end_time by kd. */
export function finishMliteQueue(kd: number) {
  return directFinishQueue(getSimrsPool(), kd);
}

/** simpannorm only accepts a 6-character RM; verified by reading the row back by its kd. */
export async function saveMliteRm(kd: number, noantrian: string, type: MliteType, noRkmMedis: string) {
  await directSimpanNoRm(getSimrsPool(), type, noantrian, noRkmMedis);
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
