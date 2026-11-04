import { expect, test } from "bun:test";
import { hariKerja, kelasLabel, sortKamar } from "./display-kamar";

test("hariKerja uses WITA date", () => {
  // 2026-11-04 17:00 UTC = Thu 01:00 WITA
  expect(hariKerja(new Date("2026-11-04T17:00:00Z"))).toBe("KAMIS");
  expect(hariKerja(new Date("2026-11-08T03:00:00Z"))).toBe("AKHAD");
});

test("kelas order and labels", () => {
  const row = (kelas: string) => ({ kelas, label: kelasLabel(kelas), kapasitas: 1, terisi: 0, tarif: 0, tarifBeda: false });
  expect(sortKamar([row("Kelas VIP"), row("Kelas 2"), row("Kelas 1")]).map((r) => r.label)).toEqual(["KELAS 1", "KELAS 2", "VIP"]);
});
