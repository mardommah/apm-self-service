import { and, asc, desc, eq, gt, gte, isNull, lt } from "drizzle-orm";
import type { RowDataPacket } from "mysql2/promise";
import { cleanPatientName } from "~/lib/poli-call";
import { getDb } from "../db";
import { poliCalls } from "../schema";
import { getSimrsPool } from "../simrs";
import { getJadwalHariIni, hariKerja } from "./display-kamar";

// Poli not called on the poli TV (same list as the old PHP display samples/antrian_poli).
export const EXCLUDED_POLI = ["RAD", "FAR", "IGDK", "PAR", "IRM", "OBG", "PONEK", "LAB", "U017"];

export type AntriPoliRow = {
  kdDokter: string;
  kdPoli: string;
  status: string;
  noRawat: string;
  noReg: string;
  pasien: string;
  poli: string;
  dokter: string;
};

export type PoliCall = {
  id: number;
  isRecall: boolean;
  queueNumber: string;
  pasien: string;
  poli: string;
  kdPoli: string;
  dokter: string;
  /** null = taken from SIMRS without a recorded call time (currentFromSimrs). */
  calledAt: Date | null;
};

export type PoliBoardRow = { kdPoli: string; poli: string; dokter: string; queueNumber: string | null; pasien: string | null; calling: boolean };

/** Today's date in WITA as YYYY-MM-DD (reg_periksa.tgl_registrasi). */
export function todayWita(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(now);
}

export const poliQueueNumber = (row: Pick<AntriPoliRow, "kdPoli" | "noReg">) => `${row.kdPoli}${row.noReg}`;

/** SIMRS antripoli rows of patients registered today. Read only: the old PHP display still updates status. */
export async function getAntriPoliToday(date: string): Promise<AntriPoliRow[]> {
  const [rows] = await getSimrsPool().query<RowDataPacket[]>(
    `SELECT a.kd_dokter, a.kd_poli, a.status, a.no_rawat, r.no_reg, p.nm_pasien, pl.nm_poli, d.nm_dokter
     FROM antripoli a
     JOIN reg_periksa r ON r.no_rawat = a.no_rawat
     JOIN pasien p ON p.no_rkm_medis = r.no_rkm_medis
     JOIN poliklinik pl ON pl.kd_poli = a.kd_poli
     JOIN dokter d ON d.kd_dokter = a.kd_dokter
     WHERE r.tgl_registrasi = ? AND a.kd_poli NOT IN (?)`,
    [date, EXCLUDED_POLI],
  );
  return rows.map((r) => ({
    kdDokter: String(r.kd_dokter),
    kdPoli: String(r.kd_poli),
    status: String(r.status),
    noRawat: String(r.no_rawat),
    noReg: String(r.no_reg),
    pasien: cleanPatientName(String(r.nm_pasien)),
    poli: String(r.nm_poli),
    dokter: String(r.nm_dokter),
  }));
}

type Seen = { noRawat: string; status: string };

/**
 * Turns antripoli snapshots into call events. SIMRS writes one row per doctor+poli: a new no_rawat in
 * status 1/2 is a new call, the same no_rawat going back to status 1 is a recall.
 * The first snapshot only seeds (no announcements for calls made before this server started).
 */
export function createPoliCallDetector() {
  let seen: Map<string, Seen> | null = null;
  return (rows: AntriPoliRow[]): AntriPoliRow[] => {
    const next = new Map(rows.map((r) => [`${r.kdDokter}|${r.kdPoli}`, { noRawat: r.noRawat, status: r.status }]));
    const prev = seen;
    seen = next;
    if (!prev) return [];
    return rows.filter((r) => {
      if (r.status !== "1" && r.status !== "2") return false;
      const before = prev.get(`${r.kdDokter}|${r.kdPoli}`);
      return !before || before.noRawat !== r.noRawat || (r.status === "1" && before.status !== "1");
    });
  };
}

/** WITA day range of a YYYY-MM-DD date; independent of the server timezone (drizzle stores DATETIME as UTC). */
export function dayRange(date: string) {
  const start = new Date(`${date}T00:00:00+08:00`);
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

const MIN_REFRESH_MS = 1_000;
// shortcut: the detector's last snapshot is in memory (one pm2 process): calls made while the server is down are not recorded.
const detect = createPoliCallDetector();
let rows: AntriPoliRow[] = [];
let refreshedAt = 0;
let inflight: Promise<void> | null = null;

/** Writes one detected call: recall when the slot's last call is the same patient, otherwise closes the slot's open call. */
async function recordCall(row: AntriPoliRow, today: Date) {
  const db = getDb();
  const slot = and(eq(poliCalls.kdDokter, row.kdDokter), eq(poliCalls.kdPoli, row.kdPoli), gte(poliCalls.calledAt, today));
  const [last] = await db.select({ noRawat: poliCalls.noRawat }).from(poliCalls).where(slot).orderBy(desc(poliCalls.id)).limit(1);
  const isRecall = last?.noRawat === row.noRawat;
  const now = new Date();
  if (!isRecall) await db.update(poliCalls).set({ finishedAt: now }).where(and(slot, isNull(poliCalls.finishedAt)));
  await db.insert(poliCalls).values({
    noRawat: row.noRawat,
    kdPoli: row.kdPoli,
    kdDokter: row.kdDokter,
    queueNumber: poliQueueNumber(row),
    pasien: row.pasien.slice(0, 100),
    poli: row.poli.slice(0, 100),
    dokter: row.dokter.slice(0, 100),
    isRecall,
    calledAt: now,
  });
}

async function refresh() {
  const date = todayWita();
  rows = await getAntriPoliToday(date);
  refreshedAt = Date.now();
  for (const row of detect(rows)) await recordCall(row, dayRange(date).start);
}

const callColumns = {
  id: poliCalls.id,
  isRecall: poliCalls.isRecall,
  queueNumber: poliCalls.queueNumber,
  pasien: poliCalls.pasien,
  poli: poliCalls.poli,
  kdPoli: poliCalls.kdPoli,
  dokter: poliCalls.dokter,
  calledAt: poliCalls.calledAt,
};

/** Every TV polls this; one SIMRS query per second at most, shared by all TVs (refresh runs one at a time). */
export async function pollPoliCalls(afterId: number | undefined) {
  if (Date.now() - refreshedAt >= MIN_REFRESH_MS) {
    inflight ??= refresh().finally(() => (inflight = null));
    await inflight;
  }
  const db = getDb();
  const today = gte(poliCalls.calledAt, dayRange(todayWita()).start);
  const [calls, [lastCall]] = await Promise.all([
    afterId === undefined
      ? Promise.resolve([])
      : db.select(callColumns).from(poliCalls).where(and(today, gt(poliCalls.id, afterId))).orderBy(asc(poliCalls.id)).limit(20),
    db.select(callColumns).from(poliCalls).where(today).orderBy(desc(poliCalls.id)).limit(1),
  ]);
  return { calls, lastCall: lastCall ?? currentFromSimrs(rows), cursor: Math.max(afterId ?? 0, lastCall?.id ?? 0), rows };
}

/**
 * Before the first recorded call today (e.g. right after deploy/restart): the patient SIMRS shows as being called.
 * Status 2 = on the old PHP display now, then status 1 (called, not shown yet). id 0: never announced or used as cursor.
 */
export function currentFromSimrs(rows: AntriPoliRow[]): PoliCall | null {
  const row = rows.find((r) => r.status === "2") ?? rows.find((r) => r.status === "1");
  if (!row) return null;
  return { id: 0, isRecall: false, queueNumber: poliQueueNumber(row), pasien: row.pasien, poli: row.poli, kdPoli: row.kdPoli, dokter: row.dokter, calledAt: null };
}

/** Last recorded call per poli today (newest first wins). */
async function lastCallPerPoli() {
  const calls = await getDb()
    .select(callColumns)
    .from(poliCalls)
    .where(gte(poliCalls.calledAt, dayRange(todayWita()).start))
    .orderBy(desc(poliCalls.id))
    .limit(1000);
  const latest = new Map<string, PoliCall>();
  for (const call of calls) if (!latest.has(call.kdPoli)) latest.set(call.kdPoli, call);
  return latest;
}

/**
 * One row per poli with a schedule today. Patient = last recorded call there (kept after antripoli is overwritten);
 * a row SIMRS shows as being called (status 1/2) wins and marks the poli as calling.
 */
export async function getPoliBoard(rows: AntriPoliRow[]): Promise<PoliBoardRow[]> {
  const [jadwal, lastCalls] = await Promise.all([getJadwalHariIni(hariKerja()), lastCallPerPoli()]);
  const board = new Map<string, PoliBoardRow>();
  for (const j of jadwal) {
    if (EXCLUDED_POLI.includes(j.kdPoli) || board.has(j.kdPoli)) continue;
    const last = lastCalls.get(j.kdPoli);
    board.set(j.kdPoli, { kdPoli: j.kdPoli, poli: j.poli, dokter: last?.dokter ?? j.dokter, queueNumber: last?.queueNumber ?? null, pasien: last?.pasien ?? null, calling: false });
  }
  for (const r of rows) {
    const calling = r.status === "1" || r.status === "2";
    const current = board.get(r.kdPoli);
    if (current?.calling || (!calling && current?.queueNumber)) continue;
    board.set(r.kdPoli, { kdPoli: r.kdPoli, poli: r.poli, dokter: r.dokter, queueNumber: poliQueueNumber(r), pasien: r.pasien, calling });
  }
  // Schedule order (jam_mulai); polis calling without a schedule today (substitute doctor) come last.
  return [...board.values()];
}

/** Admin history: every call of one day, newest first. */
export async function listPoliCalls(date: string) {
  const { start, end } = dayRange(date);
  return getDb()
    .select({ ...callColumns, noRawat: poliCalls.noRawat, finishedAt: poliCalls.finishedAt })
    .from(poliCalls)
    .where(and(gte(poliCalls.calledAt, start), lt(poliCalls.calledAt, end)))
    .orderBy(desc(poliCalls.id))
    .limit(2000);
}
