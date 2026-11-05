import { expect, test } from "bun:test";
import type { RowDataPacket } from "mysql2/promise";
import { formatOperasi, formatOperator, formatOpRow } from "./display-poli-mata";

const row = (over: Record<string, unknown> = {}) =>
  ({
    no_rawat: "2026/11/05/000026",
    kode_paket: "PK000001",
    jam_mulai: "11:05:00",
    jam_selesai: "11:15:00",
    status: "Menunggu",
    umurdaftar: 63,
    sttsumur: "Th",
    jk: "L",
    nm_perawatan: "OPERASI KATARAK - Khusus (Phacoemulsification)",
    nm_dokter: "dr. ADRIYANTO W A IBRAHIM, SP.M",
    nm_ruang_ok: "OK Mata",
    ...over,
  }) as unknown as RowDataPacket;

test("operation and operator names", () => {
  expect(formatOperasi("OPERASI KATARAK - Khusus (Phacoemulsification)")).toBe("Operasi Katarak – Khusus (Phacoemulsification)");
  expect(formatOperasi("KALAZION (T.INCISI)")).toBe("Kalazion (T.INCISI)");
  expect(formatOperator("dr. ADRIYANTO W A IBRAHIM, SP.M")).toBe("dr. Adriyanto W A Ibrahim, Sp.M");
  expect(formatOperator("dr. Fajar Ferdian, Sp. M")).toBe("dr. Fajar Ferdian, Sp. M");
});

test("formatOpRow: times, age, status", () => {
  const r = formatOpRow(row());
  expect(r).toMatchObject({ mulai: "11:05", selesai: "11:15", umur: "63 Th", jk: "L", status: "Menunggu", ruang: "OK MATA" });
  expect(r.key).toBe("2026/11/05/000026|PK000001|11:05:00");
  expect(r).not.toHaveProperty("pasien");
  // SIMRS data has jam_selesai before jam_mulai: only the start shows.
  expect(formatOpRow(row({ jam_selesai: "11:00:00" })).selesai).toBeNull();
  expect(formatOpRow(row({ jam_selesai: null })).selesai).toBeNull();
  expect(formatOpRow(row({ status: null })).status).toBe("Menunggu");
  expect(formatOpRow(row({ status: "Proses Operasi" })).status).toBe("Proses Operasi");
});
