import { createServerFn } from "@tanstack/react-start";
import { getJadwalHariIni, hariKerja } from "../functions/display-kamar";
import { addLibur, deleteLibur, listDokter, listLiburAktif, tanggalWita, validateLibur } from "../functions/dokter-libur";
import { applySheetTutup, getSheetTutupHariIni, sheetId } from "../functions/jadwal-sheet";
import { requireAdminToken } from "./admin-auth";

export const getDokterLiburAction = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    const [dokter, libur, jadwal, sheet] = await Promise.all([
      listDokter(),
      listLiburAktif(),
      getJadwalHariIni(hariKerja()),
      getSheetTutupHariIni(tanggalWita()),
    ]);
    const { matches } = applySheetTutup(jadwal, sheet.rows);
    return { dokter, libur, sheet: { enabled: Boolean(sheetId()), error: sheet.error ?? null, matches } };
  });

export const addDokterLiburAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; kdDokter: string; jenis: string; tanggalMulai: string; tanggalSelesai: string; keterangan?: string }) => {
    validateLibur(data);
    return data;
  })
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    await addLibur(data);
    return { ok: true };
  });

export const deleteDokterLiburAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: number }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    await deleteLibur(Number(data.id));
    return { ok: true };
  });
