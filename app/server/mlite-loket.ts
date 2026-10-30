import type { RowDataPacket } from "mysql2/promise";
import { getSimrsPool } from "./simrs";

// Same endpoints the mLITE "Pemanggil Antrian Loket" page uses (anjungan/setpanggil, anjungan/simpannorm).
const MLITE_TYPE = "loket";

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
 * Mirrors mLITE "Pemanggil Antrian Loket" (plugins/anjungan Admin.php show=panggil_loket):
 * a new call first closes the previous number (end_time) and moves the counter (mlite_settings panggil_loket_nomor)
 * to this number, then setpanggil sets status 1 + loket so mLITE's own display can announce it.
 * A recall is only the bullhorn button: setpanggil again.
 */
export async function callMliteLoket(noantrian: string, loket: number, recall: boolean) {
  const counter = String(loket);
  if (!recall) {
    await callAnjungan("loket", { show: "panggil_loket", loket: counter });
    await callAnjungan("loket", { show: "panggil_loket", antrian: noantrian, reset: counter });
  }
  await callAnjunganJson("setpanggil", { noantrian, type: MLITE_TYPE, loket: counter });
}

/** simpannorm only accepts a 6-character RM; verified by reading the row back by its kd. */
export async function saveMliteRm(kd: number, noantrian: string, noRkmMedis: string) {
  await callAnjunganJson("simpannorm", { noantrian, type: MLITE_TYPE, no_rkm_medis: noRkmMedis });
  const [rows] = await getSimrsPool().query<RowDataPacket[]>(
    "SELECT no_rkm_medis FROM mlite_antrian_loket WHERE kd = ?",
    [kd],
  );
  if (rows[0]?.no_rkm_medis !== noRkmMedis) throw new Error("MLITE_RM_NOT_SAVED");
}
