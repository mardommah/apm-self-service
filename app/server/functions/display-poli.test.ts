import { expect, test } from "bun:test";
import { cleanPatientName, poliCallText, poliLabel, titleCaseName } from "~/lib/poli-call";
import { createPoliCallDetector, currentFromSimrs, dayRange, todayWita, type AntriPoliRow } from "./display-poli";

const row = (kdDokter: string, noRawat: string, status: string): AntriPoliRow => ({
  kdDokter,
  kdPoli: "PU",
  status,
  noRawat,
  noReg: "001",
  pasien: "X",
  poli: "Poli Umum",
  dokter: "dr. A",
});

test("detector seeds first snapshot, then reports new patient and recall", () => {
  const detect = createPoliCallDetector();
  expect(detect([row("D1", "r1", "1")])).toEqual([]);
  // old PHP display flips 1 -> 2: not a new call
  expect(detect([row("D1", "r1", "2")])).toEqual([]);
  // next patient for the same doctor+poli
  expect(detect([row("D1", "r2", "1")]).map((r) => r.noRawat)).toEqual(["r2"]);
  // missed status 1 entirely: still detected by the no_rawat change
  expect(detect([row("D1", "r3", "2")]).map((r) => r.noRawat)).toEqual(["r3"]);
  // recall: same patient back to status 1
  expect(detect([row("D1", "r3", "1")]).map((r) => r.noRawat)).toEqual(["r3"]);
  // old PHP display passed 1 -> 2 -> 3 between snapshots: new patient still detected
  expect(detect([row("D1", "r4", "3")]).map((r) => r.noRawat)).toEqual(["r4"]);
  // same patient staying 3, or 0 (not called), is no call
  expect(detect([row("D1", "r4", "3")])).toEqual([]);
  expect(detect([row("D1", "r5", "0")])).toEqual([]);
  // recall whose status 1 was missed (3 -> 2)
  expect(detect([row("D1", "r4", "3")]).map((r) => r.noRawat)).toEqual(["r4"]);
  expect(detect([row("D1", "r4", "2")]).map((r) => r.noRawat)).toEqual(["r4"]);
});

test("name cleanup, labels and speech text", () => {
  expect(cleanPatientName("SITI AMINAH, NY")).toBe("SITI AMINAH");
  expect(cleanPatientName("BUDI . TN")).toBe("BUDI");
  expect(cleanPatientName("N U R H I K M A H")).toBe("NURHIKMAH");
  expect(poliLabel("POLI THT-KL")).toBe("Poli THT-KL");
  expect(poliLabel("KIA (BIDAN)")).toBe("KIA (Bidan)");
  expect(poliLabel("POLI UMUM (DOKTER UMUM)")).toBe("Poli Umum (Dokter Umum)");
  expect(titleCaseName("PUTRI RISKA LESTARI")).toBe("Putri Riska Lestari");
  expect(poliCallText("THT002", "DG MANAI", "POLI THT-KL")).toBe(
    "Nomor antrian THT 2. Atas nama daeng manai. Silahkan menuju ke ruang poli THT-KAEL.",
  );
  expect(poliCallText("PM013", "H. ABDUL", "Poli Mata")).toBe("Nomor antrian PM 13. Atas nama haji abdul. Silahkan menuju ke ruang poli mata.");
});

test("todayWita", () => {
  expect(todayWita(new Date("2026-11-04T17:00:00Z"))).toBe("2026-11-05");
});

test("dayRange is a WITA day", () => {
  const { start, end } = dayRange("2026-11-04");
  expect(start.toISOString()).toBe("2026-11-03T16:00:00.000Z");
  expect(end.toISOString()).toBe("2026-11-04T16:00:00.000Z");
});

test("currentFromSimrs prefers the row on the old display (status 2)", () => {
  expect(currentFromSimrs([row("D1", "r1", "3"), row("D2", "r2", "1"), row("D3", "r3", "2")])?.dokter).toBe("dr. A");
  expect(currentFromSimrs([row("D1", "r1", "3"), row("D2", "r2", "1")])?.queueNumber).toBe("PU001");
  expect(currentFromSimrs([row("D1", "r1", "3")])).toBeNull();
});
