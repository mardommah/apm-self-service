import { expect, test } from "bun:test";
import { jadwalStatus } from "./DisplayJadwalTable";

test("jadwalStatus with two sessions", () => {
  const row = { dokter: "dr A", poli: "Umum", kdPoli: "U", sesi: [{ mulai: "08:00", selesai: "12:00" }, { mulai: "16:00", selesai: "20:00" }] };
  expect(jadwalStatus(row, "07:30")).toBe("terjadwal");
  expect(jadwalStatus(row, "08:00")).toBe("praktik");
  expect(jadwalStatus(row, "13:00")).toBe("terjadwal");
  expect(jadwalStatus(row, "17:00")).toBe("praktik");
  expect(jadwalStatus(row, "20:00")).toBe("selesai");
});
