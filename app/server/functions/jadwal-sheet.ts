import type { JadwalRow } from "./display-kamar";

/**
 * Doctor closures from the Google Sheet "PERUBAHAN JADWAL DPJP" (one tab per month, filled by staff).
 * Only rows with JADWAL PERUBAHAN = TUTUP and STATUS = ACC for today are used.
 * The sheet must be shared "anyone with the link can view"; read through the gviz CSV endpoint.
 */

export type SheetTutup = { dokter: string; mulai: string; selesai: string; jenis: "tutup" | "cuti"; alasan: string };
export type SheetMatch = SheetTutup & { kdDokter: string | null; matchedDokter: string | null };

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MEI", "JUNI", "JULI", "AGUST", "SEPT", "OKT", "NOV", "DES"];
const MONTH_FULL = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
const CACHE_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 8_000;

export function sheetId() {
  return process.env.JADWAL_SHEET_ID?.trim() || "";
}

/** Minimal RFC 4180 CSV parser (quoted fields, "" escapes, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += text[++i];
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") (row.push(field), (field = ""));
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field), rows.push(row), (row = []), (field = "");
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  return rows;
}

/** Tab names tried for a month; staff used both "NOV 2026" and "NOVEMBER". */
export function tabCandidates(today: string) {
  const [y, m] = today.split("-").map(Number);
  return [`${MONTH_ABBR[m - 1]} ${y}`, `${MONTH_FULL[m - 1]} ${y}`, MONTH_FULL[m - 1]];
}

/** gviz returns the FIRST tab for an unknown name, so the "Periode : NOVEMBER 2026" row must match the month. */
export function isPeriode(rows: string[][], today: string) {
  const [y, m] = today.split("-").map(Number);
  const periode = rows.slice(0, 6).flat().find((c) => /periode/i.test(c))?.toUpperCase() ?? "";
  return periode.includes(String(y)) && periode.includes(MONTH_FULL[m - 1]);
}

/** "09.00-14.00" / "15:00 - 17:00" → ["09:00", "14:00"]. */
export function parseJam(text: string): [string, string] | null {
  const m = text.match(/(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return null;
  const hm = (h: string, mm: string) => `${h.padStart(2, "0")}:${mm}`;
  return [hm(m[1], m[2]), hm(m[3], m[4])];
}

/** "Selasa 10/11/2026", "Kamis, 01-10-2026" → "2026-11-10"; recurring text like "Senin, Rabu, Jumat" → null. */
export function parseTanggal(text: string): string | null {
  const m = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** Rows: JAM PRAKTEK, NAMA DOKTER, TANGGAL PERUBAHAN, JADWAL PERUBAHAN, ALASAN, PJ, STATUS. */
export function parseTutupRows(rows: string[][], today: string): SheetTutup[] {
  const out: SheetTutup[] = [];
  for (const [jamText = "", dokter = "", tanggal = "", perubahan = "", alasan = "", , status = ""] of rows) {
    if (perubahan.trim().toUpperCase() !== "TUTUP" || status.trim().toUpperCase() !== "ACC") continue;
    if (parseTanggal(tanggal) !== today || !dokter.trim()) continue;
    const jam = parseJam(jamText) ?? ["00:00", "23:59"];
    out.push({ dokter: dokter.trim(), mulai: jam[0], selesai: jam[1], jenis: /cuti/i.test(alasan) ? "cuti" : "tutup", alasan: alasan.trim() });
  }
  return out;
}

/** Name without titles/degrees, letters only: "dr. Hj Munjia Assagaf, Sp.M" → "munjiaassagaf". */
export function namaInti(nama: string) {
  let s = nama.toLowerCase().split(",")[0];
  s = s.replace(/(^|[\s.])sp[\s.].*$/, "");
  s = s.replace(/^\s*((drg|dr|hj|h)\.?\s*)+/, "");
  return s.replace(/[^a-z]/g, "");
}

function editDistance(a: string, b: string) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Free-text sheet name → one of today's doctors; exact/prefix first, then ≤ 2 typos ("nurfadhila" vs "nurfadhilah"). Ambiguous → null. */
export function cocokDokter(namaSheet: string, dokter: { kdDokter: string; dokter: string }[]) {
  const a = namaInti(namaSheet);
  if (a.length < 4) return null;
  const unique = (list: typeof dokter) => [...new Map(list.map((d) => [d.kdDokter, d])).values()];
  const prefix = unique(dokter.filter((d) => {
    const b = namaInti(d.dokter);
    return b.length >= 4 && (a.startsWith(b) || b.startsWith(a));
  }));
  if (prefix.length) return prefix.length === 1 ? prefix[0] : null;
  const typo = unique(dokter.filter((d) => a.length >= 8 && editDistance(a, namaInti(d.dokter)) <= 2));
  return typo.length === 1 ? typo[0] : null;
}

/** Marks sessions overlapping a closed range; a row with every session closed gets `libur`. Manual `libur` is kept. */
export function applySheetTutup(jadwal: JadwalRow[], tutup: SheetTutup[]): { jadwal: JadwalRow[]; matches: SheetMatch[] } {
  const matches = tutup.map((t) => {
    const d = cocokDokter(t.dokter, jadwal);
    return { ...t, kdDokter: d?.kdDokter ?? null, matchedDokter: d?.dokter ?? null };
  });
  const result = jadwal.map((row): JadwalRow => {
    const own = matches.filter((m) => m.kdDokter === row.kdDokter);
    if (!own.length || row.libur) return row;
    const sesi = row.sesi.map((s) => (own.some((m) => m.mulai < s.selesai && s.mulai < m.selesai) ? { ...s, tutup: true } : s));
    if (!sesi.some((s) => s.tutup)) return row;
    const libur: JadwalRow["libur"] = sesi.every((s) => s.tutup) ? (own.some((m) => m.jenis === "cuti") ? "cuti" : "tutup") : undefined;
    return { ...row, sesi, ...(libur && { libur }) };
  });
  return { jadwal: result, matches };
}

async function fetchTab(id: string, tab: string) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`SHEET_HTTP_${res.status}`);
  return parseCsv(await res.text());
}

let cache: { key: string; at: number; rows: SheetTutup[]; error?: string } | null = null;

/** Today's TUTUP+ACC rows, cached 5 minutes (all TVs share it); on fetch error the last good result for today is reused. */
export async function getSheetTutupHariIni(today: string): Promise<{ rows: SheetTutup[]; error?: string }> {
  const id = sheetId();
  if (!id) return { rows: [] };
  const key = `${id}|${today}`;
  if (cache?.key === key && Date.now() - cache.at < CACHE_MS) return { rows: cache.rows, error: cache.error };
  try {
    for (const tab of tabCandidates(today)) {
      const rows = await fetchTab(id, tab);
      if (!isPeriode(rows, today)) continue;
      cache = { key, at: Date.now(), rows: parseTutupRows(rows, today) };
      return { rows: cache.rows };
    }
    throw new Error("SHEET_TAB_NOT_FOUND");
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.warn("[jadwal-sheet]", error);
    // Errors are cached too, so a missing tab or Google outage is retried every 5 minutes, not on every TV poll.
    cache = { key, at: Date.now(), rows: cache?.key === key ? cache.rows : [], error };
    return { rows: cache.rows, error };
  }
}
