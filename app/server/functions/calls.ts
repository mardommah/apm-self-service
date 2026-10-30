"use server";

import { and, asc, count, desc, eq, gt, gte } from "drizzle-orm";
import { getDb } from "../db";
import { queueCalls, services, visits } from "../schema";
import { getDailyQueueNumber } from "./visits";

export interface QueueCall {
  id: number;
  loket: number;
  isRecall: boolean;
  calledAt: Date;
  queueNumber: string;
  serviceLabel: string;
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function createQueueCall(visitId: string, loket: number) {
  const db = getDb();
  const [visit] = await db.select({ id: visits.id }).from(visits).where(eq(visits.id, visitId)).limit(1);
  if (!visit) throw new Error("Visit not found");
  const [previous] = await db
    .select({ total: count() })
    .from(queueCalls)
    .where(eq(queueCalls.visitId, visitId));
  await db.insert(queueCalls).values({
    visitId,
    loket,
    isRecall: Number(previous?.total ?? 0) > 0,
    calledAt: new Date(),
  });
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
      serviceLabel: services.label,
    })
    .from(queueCalls)
    .innerJoin(visits, eq(queueCalls.visitId, visits.id))
    .innerJoin(services, eq(visits.serviceId, services.id));
}

async function withQueueNumber(rows: Awaited<ReturnType<typeof selectCalls>>): Promise<QueueCall[]> {
  return Promise.all(
    rows.map(async ({ visitId, visitCreatedAt, notes, ...call }) => ({
      ...call,
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
