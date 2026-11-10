import { expect, test } from "bun:test";
import { applySheetTutup, cocokDokter, isPeriode, namaInti, parseCsv, parseJam, parseTanggal, parseTutupRows, tabCandidates } from "./jadwal-sheet";

test("parseCsv handles quotes, escaped quotes and CRLF", () => {
  expect(parseCsv('"a,b","c""d"\r\n"x",""\n')).toEqual([["a,b", 'c"d'], ["x", ""]]);
});

test("tab names and Periode guard (gviz falls back to first tab)", () => {
  expect(tabCandidates("2026-11-10")).toEqual(["NOV 2026", "NOVEMBER 2026", "NOVEMBER"]);
  expect(isPeriode([["KLINIK"], ["Periode : NOVEMBER 2026"]], "2026-11-10")).toBe(true);
  expect(isPeriode([["Periode : Maret 2025"]], "2026-11-10")).toBe(false);
});

test("parse jam & tanggal", () => {
  expect(parseJam("09.00-14.00")).toEqual(["09:00", "14:00"]);
  expect(parseJam("9:00 - 12:30")).toEqual(["09:00", "12:30"]);
  expect(parseTanggal("Kamis 12/11/2026 ")).toBe("2026-11-12");
  expect(parseTanggal("Kamis, 01-10-2026")).toBe("2026-10-01");
  expect(parseTanggal("Senin, Rabu, Jumat")).toBeNull();
});

test("parseTutupRows: only TUTUP + ACC for today", () => {
  const rows = [
    ["JAM PRAKTEK", "NAMA DOKTER", "TANGGAL PERUBAHAN", "JADWAL PERUBAHAN", "ALASAN", "PJ", "STATUS"],
    ["15:00-17:00", "dr.Amelia dian utami Sp.THT", "Selasa 10/11/2026", "TUTUP", "CUTI", "Saida", "ACC"],
    ["09.00-14.00", "dr Adriyanto W A Ibrahim,Sp.M", "Selasa 10/11/2026", "TUTUP", "Ibadah Umrah", "Nur", "ACC"],
    ["14.00-16.00", "dr. Fajar Ferdian, Sp.M", "Selasa 10/11/2026", "TUTUP", "Seminar", "Nur", "PENDING"],
    ["12:00-14:00", "dr. Mardelina Sp.THT", "Selasa 10/11/2026", "11:00-13:00", "Kembali", "Saida", "ACC"],
    ["15:00-17:00", "dr.Amelia dian utami Sp.THT", "Rabu 11/11/2026", "TUTUP", "CUTI", "Saida", "ACC"],
  ];
  expect(parseTutupRows(rows, "2026-11-10")).toEqual([
    { dokter: "dr.Amelia dian utami Sp.THT", mulai: "15:00", selesai: "17:00", jenis: "cuti", alasan: "CUTI" },
    { dokter: "dr Adriyanto W A Ibrahim,Sp.M", mulai: "09:00", selesai: "14:00", jenis: "tutup", alasan: "Ibadah Umrah" },
  ]);
});

const SIMRS = [
  { kdDokter: "D016", dokter: "dr. Amelia Dian Utami Sp.THT-KL" },
  { kdDokter: "D035", dokter: "dr. ADRIYANTO W A IBRAHIM, SP.M" },
  { kdDokter: "D026", dokter: "dr. Nur Fadhilah Gani, Sp.THT-BKL" },
  { kdDokter: "D008", dokter: "dr. Mardelina Palonda, Sp. THT., M.Kes" },
  { kdDokter: "D017", dokter: "dr. Munjia Assagaf, Sp.M" },
  { kdDokter: "D011", dokter: "drg. Astrini Desintha Iraniza" },
];

test("doctor name matching against SIMRS names", () => {
  expect(namaInti("dr. Hj Munjia Assagaf, Sp.M")).toBe("munjiaassagaf");
  expect(cocokDokter("dr.Amelia dian utami Sp.THT", SIMRS)?.kdDokter).toBe("D016");
  expect(cocokDokter("dr Adriyanto W A Ibrahim,Sp.M", SIMRS)?.kdDokter).toBe("D035");
  expect(cocokDokter("dr. nurfadhila gani Sp.THT", SIMRS)?.kdDokter).toBe("D026");
  expect(cocokDokter("dr. Mardelina Sp.THT", SIMRS)?.kdDokter).toBe("D008");
  expect(cocokDokter("drg. Astrini Desintha Iraniza, S.Kg", SIMRS)?.kdDokter).toBe("D011");
  expect(cocokDokter("drg. Nur Asyura Maskur, S.Kg", SIMRS)).toBeNull();
});

test("applySheetTutup: overlapping sessions closed, whole row → libur, manual kept", () => {
  const row = (kdDokter: string, dokter: string, sesi: [string, string][], libur?: "cuti") => ({ kdDokter, dokter, poli: "P", kdPoli: "P", sesi: sesi.map(([mulai, selesai]) => ({ mulai, selesai })), ...(libur && { libur }) });
  const { jadwal, matches } = applySheetTutup(
    [row("D035", SIMRS[1].dokter, [["09:00", "12:15"], ["12:30", "14:00"]]), row("D017", SIMRS[4].dokter, [["16:00", "18:10"], ["18:25", "19:30"]]), row("D016", SIMRS[0].dokter, [["15:00", "17:00"]], "cuti")],
    [
      { dokter: "dr Adriyanto W A Ibrahim,Sp.M", mulai: "09:00", selesai: "14:00", jenis: "tutup", alasan: "Umrah" },
      { dokter: "dr. Hj Munjia Assagaf, Sp.M", mulai: "18:25", selesai: "19:30", jenis: "tutup", alasan: "x" },
      { dokter: "drg. Nur Asyura", mulai: "18:00", selesai: "21:00", jenis: "tutup", alasan: "x" },
    ],
  );
  expect(jadwal[0].libur).toBe("tutup");
  expect(jadwal[1].libur).toBeUndefined();
  expect(jadwal[1].sesi.map((s) => Boolean(s.tutup))).toEqual([false, true]);
  expect(jadwal[2].libur).toBe("cuti");
  expect(matches.map((m) => m.kdDokter)).toEqual(["D035", "D017", null]);
});
