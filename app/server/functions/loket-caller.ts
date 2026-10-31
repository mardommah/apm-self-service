"use server";

import { and, asc, desc, eq, gte, notExists } from "drizzle-orm";
import { getDb } from "../db";
import { saveMliteRm } from "../mlite-loket";
import { queueCalls, services, visits } from "../schema";
import { getDailyQueueNumber, LOKET_SERVICE_CODES, markServed, mlitePrefix, parseMliteNote } from "./visits";

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const visitFields = { id: visits.id, status: visits.status, createdAt: visits.createdAt, notes: visits.notes, queueNumber: visits.queueNumber };

function todayVisitsOf(serviceCode: string) {
  return and(eq(services.code, serviceCode), gte(visits.createdAt, todayStart()));
}

function waitingUncalled(serviceCode: string) {
  const db = getDb();
  return db
    .select(visitFields)
    .from(visits)
    .innerJoin(services, eq(visits.serviceId, services.id))
    .where(
      and(
        todayVisitsOf(serviceCode),
        eq(visits.status, "waiting"),
        notExists(db.select({ id: queueCalls.id }).from(queueCalls).where(eq(queueCalls.visitId, visits.id))),
      ),
    )
    .orderBy(asc(visits.createdAt));
}

/** Per service card: last called ticket today and how many are still waiting to be called. */
export async function getLoketCallerState() {
  return Promise.all(
    LOKET_SERVICE_CODES.map(async (code) => {
      const [service] = await getDb()
        .select({ label: services.label, queuePrefix: services.queuePrefix })
        .from(services)
        .where(eq(services.code, code));
      const [last] = await getDb()
        .select({ ...visitFields, loket: queueCalls.loket, finishedAt: queueCalls.finishedAt })
        .from(queueCalls)
        .innerJoin(visits, eq(queueCalls.visitId, visits.id))
        .innerJoin(services, eq(visits.serviceId, services.id))
        .where(and(todayVisitsOf(code), gte(queueCalls.calledAt, todayStart())))
        .orderBy(desc(queueCalls.id))
        .limit(1);
      const waitingRows = await waitingUncalled(code);
      const newestRow = waitingRows.at(-1);
      // Lets the caller toast tickets that arrived since its last poll.
      const newest = newestRow ? { id: newestRow.id, queueNumber: await getDailyQueueNumber(newestRow) } : null;
      const current = last
        ? {
            id: last.id,
            status: last.status,
            loket: last.loket,
            queueNumber: await getDailyQueueNumber(last),
            linked: Boolean(parseMliteNote(last.notes)),
            // Latest call of this ticket marked "Selesai" (same as the visits list / TV "SELESAI DILAYANI").
            finished: last.finishedAt !== null,
          }
        : null;
      return { serviceCode: code, label: service?.label ?? code, prefix: mlitePrefix({ code, queuePrefix: service?.queuePrefix }), waiting: waitingRows.length, newest, current };
    }),
  );
}

export async function findNextVisit(serviceCode: string) {
  const [next] = await waitingUncalled(serviceCode).limit(1);
  return next ?? null;
}

/** "7", "A7" or "007" → today's ticket of this service with that number. */
export async function findVisitByNumber(serviceCode: string, input: string) {
  const wanted = input.trim().toUpperCase().replace(/^([A-Z]?)0*(\d+)$/, "$1$2");
  const rows = await getDb()
    .select(visitFields)
    .from(visits)
    .innerJoin(services, eq(visits.serviceId, services.id))
    .where(todayVisitsOf(serviceCode));
  for (const row of rows) {
    const number = (await getDailyQueueNumber(row)).replace(/^([A-Z]?)0*(\d+)$/, "$1$2");
    if (number === wanted || number.replace(/^[A-Z]/, "") === wanted) return row;
  }
  return null;
}

/** Writes the RM to SIMRS mlite_antrian_loket, then marks the ticket served. */
export async function saveVisitRm(visitId: string, noRkmMedis: string, adminId: number) {
  const [visit] = await getDb().select(visitFields).from(visits).where(eq(visits.id, visitId)).limit(1);
  const mlite = parseMliteNote(visit?.notes);
  if (!mlite) throw new Error("VISIT_NOT_IN_MLITE");
  // Checked before writing to SIMRS so a revoked/served ticket never gets an RM there.
  if (visit!.status !== "waiting") throw new Error("VISIT_NOT_WAITING");
  await saveMliteRm(mlite.kd, mlite.noantrian, mlite.type, noRkmMedis);
  const served = await markServed(visitId, adminId);
  if (!served.success) throw new Error("VISIT_NOT_WAITING");
}
