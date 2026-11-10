import type { RowDataPacket } from "mysql2/promise";
import { getSimrsPool } from "../simrs";

export type JadwalSesi = { mulai: string; selesai: string };
/** One row per doctor + poli; a doctor with two sessions today (pagi & sore) has two `sesi`, sorted by start. */
export type JadwalRow = { kdDokter: string; dokter: string; poli: string; kdPoli: string; sesi: JadwalSesi[]; libur?: "tutup" | "cuti" };
type JadwalSlot = Omit<JadwalRow, "sesi" | "libur"> & JadwalSesi;
export type KamarRow = { kelas: string; label: string; kapasitas: number; terisi: number; tarif: number; tarifBeda: boolean };

const HARI_KERJA = ["AKHAD", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const KELAS_ORDER = ["Kelas 1", "Kelas 2", "Kelas 3", "Kelas Utama", "Kelas VIP", "Kelas VVIP"];
const KELAS_LABEL: Record<string, string> = { "Kelas VIP": "VIP", "Kelas VVIP": "VVIP", "Kelas Utama": "UTAMA" };

/** SIMRS `jadwal.hari_kerja` for today in WITA; MySQL DAYNAME() depends on server locale and timezone. */
export function hariKerja(now = new Date()) {
  const day = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Makassar" })).getDay();
  return HARI_KERJA[day];
}

export function kelasLabel(kelas: string) {
  return KELAS_LABEL[kelas] ?? kelas.toUpperCase();
}

export function sortKamar(rows: KamarRow[]) {
  const rank = (k: string) => (KELAS_ORDER.indexOf(k) + 1 || 99);
  return [...rows].sort((a, b) => rank(a.kelas) - rank(b.kelas) || a.kelas.localeCompare(b.kelas));
}

/** Merges SIMRS `jadwal` slots (one per session) into one row per doctor + poli; identical slots count once. Keeps slot order. */
export function mergeJadwal(slots: JadwalSlot[]): JadwalRow[] {
  const rows = new Map<string, JadwalRow>();
  for (const { mulai, selesai, ...row } of slots) {
    const key = `${row.kdDokter}|${row.kdPoli}`;
    const current = rows.get(key) ?? rows.set(key, { ...row, sesi: [] }).get(key)!;
    if (!current.sesi.some((s) => s.mulai === mulai && s.selesai === selesai)) current.sesi.push({ mulai, selesai });
  }
  for (const row of rows.values()) row.sesi.sort((a, b) => a.mulai.localeCompare(b.mulai));
  return [...rows.values()];
}

export async function getJadwalHariIni(hari: string): Promise<JadwalRow[]> {
  const [rows] = await getSimrsPool().query<RowDataPacket[]>(
    `SELECT j.kd_dokter, d.nm_dokter, p.nm_poli, p.kd_poli, j.jam_mulai, j.jam_selesai
     FROM jadwal j
     JOIN dokter d ON d.kd_dokter = j.kd_dokter
     JOIN poliklinik p ON p.kd_poli = j.kd_poli
     WHERE j.hari_kerja = ?
     ORDER BY j.jam_mulai, d.nm_dokter`,
    [hari],
  );
  return mergeJadwal(rows.map((r) => ({
    kdDokter: String(r.kd_dokter),
    dokter: String(r.nm_dokter),
    poli: String(r.nm_poli),
    kdPoli: String(r.kd_poli),
    mulai: String(r.jam_mulai).slice(0, 5),
    selesai: String(r.jam_selesai).slice(0, 5),
  })));
}

export async function getKamarPerKelas(): Promise<KamarRow[]> {
  const [rows] = await getSimrsPool().query<RowDataPacket[]>(
    `SELECT kelas, COUNT(*) AS kapasitas, SUM(status <> 'KOSONG') AS terisi,
            MIN(trf_kamar) AS tarif, MAX(trf_kamar) AS tarif_max
     FROM kamar
     WHERE statusdata = '1'
     GROUP BY kelas`,
  );
  return sortKamar(
    rows.map((r) => ({
      kelas: String(r.kelas),
      label: kelasLabel(String(r.kelas)),
      kapasitas: Number(r.kapasitas),
      terisi: Number(r.terisi),
      tarif: Number(r.tarif),
      tarifBeda: Number(r.tarif_max) !== Number(r.tarif),
    })),
  );
}
