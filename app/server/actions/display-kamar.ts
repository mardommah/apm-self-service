import { createServerFn } from "@tanstack/react-start";
import { getJadwalHariIni, getKamarPerKelas, hariKerja } from "../functions/display-kamar";
import { getLiburHariIni, tanggalWita } from "../functions/dokter-libur";
import { applySheetTutup, getSheetTutupHariIni } from "../functions/jadwal-sheet";

/** Public read-only TV board: no patient data, only schedules and bed counts. */
export const getDisplayKamarAction = createServerFn({ method: "GET" }).handler(async () => {
  const hari = hariKerja();
  const today = tanggalWita();
  const [rows, kamar, libur, sheet] = await Promise.all([getJadwalHariIni(hari), getKamarPerKelas(), getLiburHariIni(today), getSheetTutupHariIni(today)]);
  const manual = rows.map((r) => (libur.has(r.kdDokter) ? { ...r, libur: libur.get(r.kdDokter) } : r));
  const { jadwal } = applySheetTutup(manual, sheet.rows);
  return { hari, jadwal, kamar, updatedAt: new Date().toISOString() };
});

export type DisplayKamarData = Awaited<ReturnType<typeof getDisplayKamarAction>>;
