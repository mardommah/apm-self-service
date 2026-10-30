"use server";

import { and, asc, count, desc, eq, gt, gte } from "drizzle-orm";
import { getDb } from "../db";
import { queueCalls, services, visits } from "../schema";
import { callMliteLoket } from "../mlite-loket";
import { getDailyQueueNumber, parseMliteNote } from "./visits";

/** called = menunggu pasien datang, serving = admin menekan Layani, finished = admin menekan Selesai. */
export type CallStatus = "called" | "serving" | "finished";

export interface QueueCall {
  id: number;
  loket: number;
  isRecall: boolean;
  calledAt: Date;
  queueNumber: string;
  serviceLabel: string;
  status: CallStatus;
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Records the call for the TV display; mLITE-linked tickets are also marked called in SIMRS (best effort). */
export async function createQueueCall(visitId: string, loket: number) {
  const db = getDb();
  const [visit] = await db
    .select({ id: visits.id, notes: visits.notes })
    .from(visits)
    .where(eq(visits.id, visitId))
    .limit(1);
  if (!visit) throw new Error("Visit not found");
  const [previous] = await db
    .select({ total: count() })
    .from(queueCalls)
    .where(eq(queueCalls.visitId, visitId));
  const isRecall = Number(previous?.total ?? 0) > 0;
  await db.insert(queueCalls).values({ visitId, loket, isRecall, calledAt: new Date() });
  const mlite = parseMliteNote(visit.notes);
  if (!mlite) return { mliteOk: true };
  try {
    await callMliteLoket(mlite.noantrian, loket, isRecall);
    return { mliteOk: true };
  } catch (error) {
    console.error("mLITE setpanggil failed", error);
    return { mliteOk: false };
  }
}

function selectCalls() {
  return getDb()
    .select({
      id: queueCalls.id,
      loket: queueCalls.loket,
      isRecall: queueCalls.isRecall,
      calledAt: queueCalls.calledAt,
      visitId: visits.id,
      visitCreatedAt: visits.createdAt,
      notes: visits.notes,
      visitStatus: visits.status,
      finishedAt: queueCalls.finishedAt,
      serviceLabel: services.label,
    })
    .from(queueCalls)
    .innerJoin(visits, eq(queueCalls.visitId, visits.id))
    .innerJoin(services, eq(visits.serviceId, services.id));
}

async function withQueueNumber(rows: Awaited<ReturnType<typeof selectCalls>>): Promise<QueueCall[]> {
  return Promise.all(
    rows.map(async ({ visitId, visitCreatedAt, notes, visitStatus, finishedAt, ...call }) => ({
      ...call,
      status: (finishedAt ? "finished" : visitStatus === "served" ? "serving" : "called") as CallStatus,
      queueNumber: await getDailyQueueNumber({ id: visitId, createdAt: visitCreatedAt, notes }),
    })),
  );
}

/** Today's calls newer than `afterId`, oldest first (announce order). */
export async function listCallsAfter(afterId: number) {
  const rows = await selectCalls()
    .where(and(gt(queueCalls.id, afterId), gte(queueCalls.calledAt, todayStart())))
    .orderBy(asc(queueCalls.id))
    .limit(20);
  return withQueueNumber(rows);
}

/** Latest call per loket today, ordered by loket number. */
export async function listLoketCalls() {
  // shortcut: scans today's calls in JS; fine for a few hundred calls/day, use GROUP BY if volume grows.
  const rows = await selectCalls()
    .where(gte(queueCalls.calledAt, todayStart()))
    .orderBy(desc(queueCalls.id))
    .limit(1000);
  const latest = new Map<number, (typeof rows)[number]>();
  for (const row of rows) if (!latest.has(row.loket)) latest.set(row.loket, row);
  return withQueueNumber([...latest.values()].sort((a, b) => a.loket - b.loket));
}
