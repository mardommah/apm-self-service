import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { RowDataPacket } from "mysql2/promise";
import { getDb } from "../db";
import { dokterLibur } from "../schema";
import { getSimrsPool } from "../simrs";

export type LiburJenis = "tutup" | "cuti";
export type DokterLibur = { id: number; kdDokter: string; jenis: LiburJenis; tanggalMulai: string; tanggalSelesai: string; keterangan: string | null };
export type DokterOption = { kdDokter: string; nama: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today as YYYY-MM-DD in WITA (same day boundary as `hariKerja`). */
export function tanggalWita(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Makassar" });
}

export function validateLibur(input: { kdDokter: string; jenis: string; tanggalMulai: string; tanggalSelesai: string; keterangan?: string }) {
  const kdDokter = input.kdDokter?.trim();
  if (!kdDokter || kdDokter.length > 20) throw new Error("DOKTER_INVALID");
  if (input.jenis !== "tutup" && input.jenis !== "cuti") throw new Error("JENIS_INVALID");
  if (!DATE_RE.test(input.tanggalMulai) || !DATE_RE.test(input.tanggalSelesai) || input.tanggalSelesai < input.tanggalMulai) {
    throw new Error("TANGGAL_INVALID");
  }
  const keterangan = input.keterangan?.trim().slice(0, 100) || null;
  return { kdDokter, jenis: input.jenis as LiburJenis, tanggalMulai: input.tanggalMulai, tanggalSelesai: input.tanggalSelesai, keterangan };
}

/** Active doctors from SIMRS (read only). */
export async function listDokter(): Promise<DokterOption[]> {
  const [rows] = await getSimrsPool().query<RowDataPacket[]>(
    "SELECT kd_dokter, nm_dokter FROM dokter WHERE status = '1' ORDER BY nm_dokter",
  );
  return rows.map((r) => ({ kdDokter: String(r.kd_dokter), nama: String(r.nm_dokter) }));
}

/** Marks that end today or later, for the admin list. */
export function listLiburAktif(today = tanggalWita()): Promise<DokterLibur[]> {
  return getDb().select({
    id: dokterLibur.id,
    kdDokter: dokterLibur.kdDokter,
    jenis: dokterLibur.jenis,
    tanggalMulai: dokterLibur.tanggalMulai,
    tanggalSelesai: dokterLibur.tanggalSelesai,
    keterangan: dokterLibur.keterangan,
  }).from(dokterLibur).where(gte(dokterLibur.tanggalSelesai, today)).orderBy(asc(dokterLibur.tanggalMulai));
}

/** kd_dokter → jenis for doctors marked on `today`; `cuti` wins over `tutup` when both overlap. */
export async function getLiburHariIni(today = tanggalWita()): Promise<Map<string, LiburJenis>> {
  const rows = await getDb().select({ kdDokter: dokterLibur.kdDokter, jenis: dokterLibur.jenis }).from(dokterLibur)
    .where(and(lte(dokterLibur.tanggalMulai, today), gte(dokterLibur.tanggalSelesai, today)));
  const map = new Map<string, LiburJenis>();
  for (const r of rows) if (map.get(r.kdDokter) !== "cuti") map.set(r.kdDokter, r.jenis);
  return map;
}

export async function addLibur(input: Parameters<typeof validateLibur>[0]) {
  await getDb().insert(dokterLibur).values(validateLibur(input));
}

export async function deleteLibur(id: number) {
  await getDb().delete(dokterLibur).where(eq(dokterLibur.id, id));
}
