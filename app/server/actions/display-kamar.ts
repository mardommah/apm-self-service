import { createServerFn } from "@tanstack/react-start";
import { getJadwalHariIni, getKamarPerKelas, hariKerja } from "../functions/display-kamar";

/** Public read-only TV board: no patient data, only schedules and bed counts. */
export const getDisplayKamarAction = createServerFn({ method: "GET" }).handler(async () => {
  const hari = hariKerja();
  const [jadwal, kamar] = await Promise.all([getJadwalHariIni(hari), getKamarPerKelas()]);
  return { hari, jadwal, kamar, updatedAt: new Date().toISOString() };
});

export type DisplayKamarData = Awaited<ReturnType<typeof getDisplayKamarAction>>;
