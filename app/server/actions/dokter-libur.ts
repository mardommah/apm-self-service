import { createServerFn } from "@tanstack/react-start";
import { addLibur, deleteLibur, listDokter, listLiburAktif, validateLibur } from "../functions/dokter-libur";
import { requireAdminToken } from "./admin-auth";

export const getDokterLiburAction = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    const [dokter, libur] = await Promise.all([listDokter(), listLiburAktif()]);
    return { dokter, libur };
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
