import type { RowDataPacket } from "mysql2/promise";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "../db";
import { poliCalls } from "../schema";
import { getSimrsPool } from "../simrs";
import { dayRange, todayWita } from "./display-poli";

/** SIMRS poliklinik.kd_poli of Poli Mata. */
export const POLI_MATA_KD = "PM";
/** SIMRS ruang_ok shown on the operation strip (O1 = OK MATA; O3 = POLI MATA small procedures not shown). */
export const OPERASI_RUANG = ["O1"];

export type CalledRow = { noRawat: string; number: string; pasien: string };
/** Rows in the "sudah dipanggil" list under the call panel. */
const CALLED_ROWS = 3;
export type OpStatus = "Menunggu" | "Proses Operasi" | "Selesai";
/** Operation schedule row of the old SIMRS jadwaloperasi.php, without the patient name. */
export type OpRow = {
  key: string;
  noRawat: string;
  umur: string;
  jk: string;
  mulai: string;
  /** null when empty or not after `mulai`. */
  selesai: string | null;
  status: OpStatus;
  operasi: string;
  operator: string;
  ruang: string;
};

/**
 * Poli Mata patients called before the current call today, newest first, one row per patient (recalls count once).
 * Their slot has moved on to the next patient, so the TV labels them "sudah terlayani".
 */
export async function getPoliMataCalled(current: { queueNumber: string; pasien: string } | null): Promise<CalledRow[]> {
  const calls = await getDb()
    .select({ noRawat: poliCalls.noRawat, number: poliCalls.queueNumber, pasien: poliCalls.pasien })
    .from(poliCalls)
    .where(and(eq(poliCalls.kdPoli, POLI_MATA_KD), gte(poliCalls.calledAt, dayRange(todayWita()).start)))
    .orderBy(desc(poliCalls.id))
    .limit(50);
  const seen = new Set<string>();
  return calls
    .filter((c) => !(c.number === current?.queueNumber && c.pasien === current.pasien) && !seen.has(c.noRawat) && seen.add(c.noRawat))
    .slice(0, CALLED_ROWS);
}

// Upper-case words (≥ 2 letters) to title case, per segment ("SP.M" -> "Sp.M"); text in brackets and mixed case stay.
const titleUpper = (text: string) =>
  text.replace(/\([^)]*\)|[A-Z]{2,}/g, (word) => (word.startsWith("(") ? word : word[0] + word.slice(1).toLowerCase()));

/** "OPERASI KATARAK - Khusus (Phaco)" -> "Operasi Katarak – Khusus (Phaco)". */
export const formatOperasi = (name: string) => titleUpper(name.trim()).replace(/ - /g, " – ");
/** "dr. ADRIYANTO W A IBRAHIM, SP.M" -> "dr. Adriyanto W A Ibrahim, Sp.M". */
export const formatOperator = (name: string) => titleUpper(name.trim());

const hhmm = (time: unknown) => (time ? String(time).slice(0, 5) : "");

export function formatOpRow(r: RowDataPacket): OpRow {
  const mulai = hhmm(r.jam_mulai);
  const selesai = hhmm(r.jam_selesai);
  const status: OpStatus = r.status === "Proses Operasi" || r.status === "Selesai" ? r.status : "Menunggu";
  return {
    key: `${r.no_rawat}|${r.kode_paket}|${r.jam_mulai}`,
    noRawat: String(r.no_rawat),
    umur: `${r.umurdaftar} ${r.sttsumur}`,
    jk: String(r.jk),
    mulai,
    selesai: selesai > mulai ? selesai : null,
    status,
    operasi: formatOperasi(String(r.nm_perawatan)),
    operator: formatOperator(String(r.nm_dokter)),
    ruang: String(r.nm_ruang_ok).toUpperCase(),
  };
}

/** Same query as SIMRS data_operasi.php, limited to OPERASI_RUANG; patient name not selected. */
async function queryOperasi(date: string): Promise<OpRow[]> {
  const [rows] = await getSimrsPool().query<RowDataPacket[]>(
    `SELECT b.no_rawat, b.kode_paket, b.jam_mulai, b.jam_selesai, b.status, r.umurdaftar, r.sttsumur, p.jk,
            po.nm_perawatan, d.nm_dokter, o.nm_ruang_ok
     FROM booking_operasi b
     JOIN reg_periksa r ON r.no_rawat = b.no_rawat
     JOIN pasien p ON p.no_rkm_medis = r.no_rkm_medis
     JOIN paket_operasi po ON po.kode_paket = b.kode_paket
     JOIN dokter d ON d.kd_dokter = b.kd_dokter
     JOIN ruang_ok o ON o.kd_ruang_ok = b.kd_ruang_ok
     WHERE b.tanggal = ? AND b.kd_ruang_ok IN (?)
     ORDER BY b.jam_mulai`,
    [date, OPERASI_RUANG],
  );
  return rows.map(formatOpRow);
}

// The old page refreshed every 5 s: one SIMRS query per 5 s shared by all TVs.
const OPERASI_CACHE_MS = 5_000;
let cache: { date: string; at: number; rows: Promise<OpRow[]> } | null = null;

export function getOperasiToday(date: string) {
  if (!cache || cache.date !== date || Date.now() - cache.at >= OPERASI_CACHE_MS) {
    const rows = queryOperasi(date);
    // A failed query is not cached.
    rows.catch(() => (cache = null));
    cache = { date, at: Date.now(), rows };
  }
  return cache.rows;
}
