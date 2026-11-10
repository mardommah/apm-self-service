import { expect, test } from "bun:test";
import { jadwalStatus } from "./DisplayJadwalTable";

test("jadwalStatus with two sessions", () => {
  const row = { kdDokter: "D1", dokter: "dr A", poli: "Umum", kdPoli: "U", sesi: [{ mulai: "08:00", selesai: "12:00" }, { mulai: "16:00", selesai: "20:00" }] };
  expect(jadwalStatus(row, "07:30")).toBe("terjadwal");
  expect(jadwalStatus(row, "08:00")).toBe("praktik");
  expect(jadwalStatus(row, "13:00")).toBe("terjadwal");
  expect(jadwalStatus(row, "17:00")).toBe("praktik");
  expect(jadwalStatus(row, "20:00")).toBe("selesai");
});

test("jadwalStatus: admin libur mark overrides session time", () => {
  const row = { kdDokter: "D1", dokter: "dr A", poli: "Umum", kdPoli: "U", sesi: [{ mulai: "08:00", selesai: "12:00" }] };
  expect(jadwalStatus({ ...row, libur: "cuti" }, "09:00")).toBe("cuti");
  expect(jadwalStatus({ ...row, libur: "tutup" }, "07:00")).toBe("tutup");
});
