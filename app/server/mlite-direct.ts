import type { Pool, PoolConnection, ResultSetHeader } from "mysql2/promise";

// Same SQL as mLITE plugins/anjungan (Site.php ajax simpanloket/simpancs, getSetPanggil, getSimpanNoRM;
// Admin.php show=panggil_loket/panggil_cs), run directly against SIMRS_DB_*.
// New queue numbers (directInsertQueue) always go this way. Calls / Simpan RM use it only on ENV=staging
// (no mLITE web app there); production keeps the HTTP endpoints for those.
export const MLITE_DIRECT_DB = process.env.ENV === "staging";

export type MliteType = "loket" | "cs";
const TABLE_TYPE: Record<MliteType, string> = { loket: "Loket", cs: "CS" };

type Db = Pool | PoolConnection;

/** Returns the new row's kd. */
export async function directInsertQueue(db: Db, type: MliteType, noantrian: number) {
  const [result] = await db.query<ResultSetHeader>(
    "INSERT INTO mlite_antrian_loket (type, noantrian, postdate, start_time, end_time) VALUES (?, ?, CURRENT_DATE(), CURRENT_TIME(), '00:00:00')",
    [TABLE_TYPE[type], String(noantrian)],
  );
  return result.insertId;
}

async function setSetting(db: Db, field: string, value: string) {
  await db.query("UPDATE mlite_settings SET value = ? WHERE module = 'anjungan' AND field = ?", [value, field]);
}

/** Admin.php ?loket=L (close current number, counter + 1) then ?antrian=N&reset=L (counter = N). */
export async function directMoveCounter(db: Db, type: MliteType, noantrian: string, loket: number) {
  const field = `panggil_${type}`;
  const [rows] = await db.query<any[]>("SELECT value FROM mlite_settings WHERE module = 'anjungan' AND field = ?", [`${field}_nomor`]);
  const counter = rows[0]?.value ?? "";
  await db.query(
    "UPDATE mlite_antrian_loket SET end_time = CURRENT_TIME() WHERE type = ? AND noantrian = ? AND postdate = CURRENT_DATE()",
    [TABLE_TYPE[type], counter],
  );
  await setSetting(db, field, String(loket));
  await setSetting(db, `${field}_nomor`, noantrian);
}

/** getSetPanggil: status 1 + loket. */
export async function directSetPanggil(db: Db, type: MliteType, noantrian: string, loket: number) {
  await db.query(
    "UPDATE mlite_antrian_loket SET status = '1', loket = ? WHERE type = ? AND noantrian = ? AND postdate = CURRENT_DATE()",
    [String(loket), TABLE_TYPE[type], noantrian],
  );
}

/** getSimpanNoRM: RM must be exactly 6 characters. */
export async function directSimpanNoRm(db: Db, type: MliteType, noantrian: string, noRkmMedis: string) {
  if (noRkmMedis.length !== 6) throw new Error("Gagal! Nomor Rekam Medis Tidak Valid");
  await db.query(
    "UPDATE mlite_antrian_loket SET no_rkm_medis = ? WHERE noantrian = ? AND type = ? AND postdate = CURRENT_DATE()",
    [noRkmMedis, noantrian, TABLE_TYPE[type]],
  );
}
