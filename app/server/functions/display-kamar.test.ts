import { expect, test } from "bun:test";
import { hariKerja, kelasLabel, mergeJadwal, sortKamar } from "./display-kamar";

test("hariKerja uses WITA date", () => {
  // 2026-11-04 17:00 UTC = Thu 01:00 WITA
  expect(hariKerja(new Date("2026-11-04T17:00:00Z"))).toBe("KAMIS");
  expect(hariKerja(new Date("2026-11-08T03:00:00Z"))).toBe("AKHAD");
});

test("kelas order and labels", () => {
  const row = (kelas: string) => ({ kelas, label: kelasLabel(kelas), kapasitas: 1, terisi: 0, tarif: 0, tarifBeda: false });
  expect(sortKamar([row("Kelas VIP"), row("Kelas 2"), row("Kelas 1")]).map((r) => r.label)).toEqual(["KELAS 1", "KELAS 2", "VIP"]);
});

test("mergeJadwal: one row per doctor + poli, sessions sorted, duplicates once", () => {
  const slot = (kdDokter: string, kdPoli: string, mulai: string, selesai: string) => ({ kdDokter, dokter: `dr ${kdDokter}`, poli: `Poli ${kdPoli}`, kdPoli, mulai, selesai });
  const rows = mergeJadwal([
    slot("D1", "U", "08:00", "12:00"),
    slot("D2", "G", "09:00", "11:00"),
    slot("D1", "U", "16:00", "20:00"),
    slot("D1", "U", "08:00", "12:00"),
    slot("D1", "A", "13:00", "14:00"),
  ]);
  expect(rows.map((r) => [r.dokter, r.kdPoli, r.sesi.map((s) => `${s.mulai}-${s.selesai}`).join(",")])).toEqual([
    ["dr D1", "U", "08:00-12:00,16:00-20:00"],
    ["dr D2", "G", "09:00-11:00"],
    ["dr D1", "A", "13:00-14:00"],
  ]);
});
