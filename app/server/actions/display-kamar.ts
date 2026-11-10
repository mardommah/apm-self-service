import { createServerFn } from "@tanstack/react-start";
import { getJadwalHariIni, getKamarPerKelas, hariKerja } from "../functions/display-kamar";
import { getLiburHariIni } from "../functions/dokter-libur";

/** Public read-only TV board: no patient data, only schedules and bed counts. */
export const getDisplayKamarAction = createServerFn({ method: "GET" }).handler(async () => {
  const hari = hariKerja();
  const [rows, kamar, libur] = await Promise.all([getJadwalHariIni(hari), getKamarPerKelas(), getLiburHariIni()]);
  const jadwal = rows.map((r) => (libur.has(r.kdDokter) ? { ...r, libur: libur.get(r.kdDokter) } : r));
  return { hari, jadwal, kamar, updatedAt: new Date().toISOString() };
});

export type DisplayKamarData = Awaited<ReturnType<typeof getDisplayKamarAction>>;
