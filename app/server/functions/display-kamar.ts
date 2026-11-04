import type { RowDataPacket } from "mysql2/promise";
import { getSimrsPool } from "../simrs";

export type JadwalRow = { dokter: string; poli: string; mulai: string; selesai: string };
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

export async function getJadwalHariIni(hari: string): Promise<JadwalRow[]> {
  const [rows] = await getSimrsPool().query<RowDataPacket[]>(
    `SELECT d.nm_dokter, p.nm_poli, j.jam_mulai, j.jam_selesai
     FROM jadwal j
     JOIN dokter d ON d.kd_dokter = j.kd_dokter
     JOIN poliklinik p ON p.kd_poli = j.kd_poli
     WHERE j.hari_kerja = ?
     ORDER BY j.jam_mulai, d.nm_dokter`,
    [hari],
  );
  return rows.map((r) => ({
    dokter: String(r.nm_dokter),
    poli: String(r.nm_poli),
    mulai: String(r.jam_mulai).slice(0, 5),
    selesai: String(r.jam_selesai).slice(0, 5),
  }));
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
