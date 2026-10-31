"use server";

import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { queueCalls } from "../schema";

/** Marks the visit's latest call as finished ("SELESAI DILAYANI" on the TV display). */
export async function finishQueueCall(visitId: string) {
  const db = getDb();
  const [latest] = await db
    .select({ id: queueCalls.id })
    .from(queueCalls)
    .where(eq(queueCalls.visitId, visitId))
    .orderBy(desc(queueCalls.id))
    .limit(1);
  if (!latest) throw new Error("CALL_NOT_FOUND");
  await db.update(queueCalls).set({ finishedAt: new Date() }).where(eq(queueCalls.id, latest.id));
}

/**
 * Visit ids (from `visitIds`) that have a call; `finished` = its latest call is finished.
 * `calledAt` = first call, `finishedAt` = latest call's finish (admin timeline).
 */
export async function getCallStates(visitIds: string[]) {
  const states = new Map<string, { finished: boolean; calledAt: Date; finishedAt: Date | null }>();
  if (visitIds.length === 0) return states;
  const rows = await getDb()
    .select({ visitId: queueCalls.visitId, calledAt: queueCalls.calledAt, finishedAt: queueCalls.finishedAt })
    .from(queueCalls)
    .where(inArray(queueCalls.visitId, visitIds))
    .orderBy(desc(queueCalls.id));
  for (const row of rows) {
    const state = states.get(row.visitId);
    // Newest first: the first row seen is the latest call, later rows move calledAt back to the first call.
    if (state) state.calledAt = row.calledAt;
    else states.set(row.visitId, { finished: row.finishedAt !== null, calledAt: row.calledAt, finishedAt: row.finishedAt });
  }
  return states;
}
