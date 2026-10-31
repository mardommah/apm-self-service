"use server";

import { eq, and, desc, gte, lte, count, sql, ne, like, notLike, or, isNull } from "drizzle-orm";
import { getDb, isDuplicateKeyError, withNamedLock } from "../db";
import { visits, services, admins } from "../schema";
import { ulid } from "~/lib/ulid";
import { createGeneralLoketQueue } from "../simrs";
import type { VisitStatus } from "../schema";
import { DEFAULT_QUEUE_PREFIX, MLITE_SERVICE_CODES, type QueuePrefix } from "~/lib/queue-prefix";

// ─── Check device lock ────────────────────────────────────────────────────────
export async function getActiveVisitByDevice(deviceId: string) {
  const db = getDb();
  const [visit] = await db
    .select({
      id: visits.id,
      status: visits.status,
      createdAt: visits.createdAt,
      service: {
        code: services.code,
        label: services.label,
      },
    })
    .from(visits)
    .innerJoin(services, eq(visits.serviceId, services.id))
    .where(and(eq(visits.deviceId, deviceId), eq(visits.status, "waiting")))
    .limit(1);

  return visit ?? null;
}

export async function assertVisitOwnedByDevice(id: string, deviceId: string) {
  const db = getDb();
  const [visit] = await db
    .select({ id: visits.id })
    .from(visits)
    .where(and(eq(visits.id, id), eq(visits.deviceId, deviceId), eq(visits.status, "waiting")))
    .limit(1);
  if (!visit) throw new Error("VISIT_DEVICE_MISMATCH");
}

// Offline kiosk tickets keep their printed number in notes, e.g. "offline:O001".
const OFFLINE_NOTE_PREFIX = "offline:";
// Tickets that are also rows in SIMRS mlite_antrian_loket: "mlite:<kd>:<number>", e.g. "mlite:9600:A7".
const MLITE_NOTE_PREFIX = "mlite:";
// Lab & vaccination are called at the registration loket too, but are not recorded in mLITE (keep app numbers).
/** Prefix set in admin settings ("A" Loket, "B" CS) for mLITE services, or null when not in mLITE. */
export function mlitePrefix(service: { code: string; queuePrefix?: QueuePrefix | null }) {
  const fallback = DEFAULT_QUEUE_PREFIX[service.code];
  return fallback ? (service.queuePrefix ?? fallback) : null;
}

export const LOKET_SERVICE_CODES = [...MLITE_SERVICE_CODES, "laboratorium", "vaksinasi"];

export function parseMliteNote(notes: string | null | undefined) {
  const match = notes?.match(/^mlite:(\d+):([AB])(\d+)$/);
  if (!match) return null;
  const type: "loket" | "cs" = match[2] === "B" ? "cs" : "loket";
  // mLITE keeps the bare number ("1"); tickets show it padded ("A001").
  return { kd: Number(match[1]), queueNumber: match[2] + match[3].padStart(3, "0"), noantrian: match[3], type };
}

export async function setServiceQueuePrefix(code: string, queuePrefix: QueuePrefix) {
  if (!MLITE_SERVICE_CODES.includes(code)) throw new Error("SERVICE_NOT_IN_MLITE");
  await getDb().update(services).set({ queuePrefix }).where(eq(services.code, code));
}

async function createMliteNote(queueType: 1 | 2) {
  try {
    const queue = await createGeneralLoketQueue(queueType);
    return `${MLITE_NOTE_PREFIX}${queue.kd}:${queue.number}`;
  } catch (error) {
    // SIMRS down must not block the kiosk: the ticket falls back to the app's own daily number.
    console.error("mLITE loket queue failed", error);
    return null;
  }
}

// ─── Create visit ─────────────────────────────────────────────────────────────
export async function createVisit(
  serviceCode: string,
  registration?: { destinationServiceCode: string; patientStatus: "baru" | "lama" },
  offline?: { id: string; createdAt: Date; queueNumber: string },
  options?: { skipMlite?: boolean; mliteQueueType?: 1 | 2; patientStatus?: "baru" | "lama" },
) {
  const db = getDb();

  // Fetch service
  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.code, serviceCode), eq(services.isActive, true)))
    .limit(1);

  if (!service) throw new Error(`Service '${serviceCode}' not found`);

  let destinationServiceId: number | null = null;
  if (registration) {
    const [destination] = await db
      .select({ id: services.id })
      .from(services)
      .where(
        and(
          eq(services.code, registration.destinationServiceCode),
          eq(services.isActive, true),
        ),
      )
      .limit(1);
    if (!destination) throw new Error("Destination service not found");
    destinationServiceId = destination.id;
  }

  const id = offline?.id ?? ulid();
  // shortcut: offline tickets synced later keep their O-number and get no mLITE row; staff record them in mLITE manually.
  // The general patient loket screen lets the patient pick the mLITE queue (1 Loket/A, 2 CS/B); others follow the service prefix.
  const prefix = mlitePrefix(service);
  const queueType = options?.mliteQueueType ?? (prefix && (prefix === "A" ? 1 : 2));
  const patientStatus = registration?.patientStatus ?? options?.patientStatus ?? null;
  // Only new patients (BPJS & general) go to mLITE for registration; every other ticket keeps the app's own number.
  const mliteNote =
    !offline && !options?.skipMlite && patientStatus === "baru" && queueType ? await createMliteNote(queueType) : null;
  const createdAt = offline?.createdAt ?? new Date();
  const notes = offline ? OFFLINE_NOTE_PREFIX + offline.queueNumber : mliteNote;
  const values = { id, serviceId: service.id, destinationServiceId, patientStatus, deviceId: null, status: "waiting" as const, createdAt, notes };
  const fixedNumber = offline?.queueNumber ?? parseMliteNote(mliteNote)?.queueNumber;
  const queueNumber = fixedNumber
    ? (await insertWithFixedQueueNumber({ ...values, queueNumber: fixedNumber }), fixedNumber)
    : await insertWithAppQueueNumber(values, appQueueLetter(service.code, patientStatus));

  return { id, service, createdAt, notes, queueNumber };
}

// App tickets get a letter per service and their own daily counter; A/B stay reserved for mLITE, O for offline kiosk2.
const APP_QUEUE_LETTERS: Record<string, string> = {
  registrasi: "C",
  poli_umum: "D",
  customer_service: "E",
  laboratorium: "L",
  vaksinasi: "V",
};

function appQueueLetter(serviceCode: string, patientStatus: "baru" | "lama" | null) {
  // Existing general patients keep D even when they picked Loket 2 (stored as customer_service).
  if (patientStatus === "lama") return serviceCode === "registrasi" ? "C" : "D";
  return APP_QUEUE_LETTERS[serviceCode] ?? "P";
}

/** Inserts the visit with the next "<letter>NNN" of its day; a named lock keeps concurrent kiosks from sharing a number. */
async function insertWithAppQueueNumber(values: typeof visits.$inferInsert, letter: string) {
  const dayStart = new Date(values.createdAt!);
  dayStart.setHours(0, 0, 0, 0);
  return withNamedLock(`apm_queue_${letter}`, async () => {
    const [row] = await getDb()
      .select({ last: sql<number>`COALESCE(MAX(CAST(SUBSTRING(${visits.queueNumber}, 2) AS UNSIGNED)), 0)` })
      .from(visits)
      .where(and(gte(visits.createdAt, dayStart), like(visits.queueNumber, `${letter}%`)));
    const queueNumber = letter + String(Number(row?.last ?? 0) + 1).padStart(3, "0");
    await getDb().insert(visits).values({ ...values, queueNumber });
    return queueNumber;
  });
}

/**
 * mLITE / offline numbers are decided before the insert. Re-syncing the same offline visit (same id) is a no-op;
 * the same number on another visit that day (uq_visits_queue_date_number) throws QUEUE_NUMBER_TAKEN.
 * No ON DUPLICATE KEY UPDATE: it would fire on the number index too and rewrite the other visit.
 */
async function insertWithFixedQueueNumber(values: typeof visits.$inferInsert) {
  try {
    await getDb().insert(visits).values(values);
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const [existing] = await getDb().select({ id: visits.id }).from(visits).where(eq(visits.id, values.id)).limit(1);
    if (!existing) throw new Error("QUEUE_NUMBER_TAKEN");
  }
}

// ─── Get visit by ID ──────────────────────────────────────────────────────────
export async function getVisitById(id: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: visits.id,
      status: visits.status,
      deviceId: visits.deviceId,
      createdAt: visits.createdAt,
      scannedAt: visits.scannedAt,
      servedAt: visits.servedAt,
      notes: visits.notes,
      queueNumber: visits.queueNumber,
      patientStatus: visits.patientStatus,
      destinationServiceId: visits.destinationServiceId,
      service: {
        code: services.code,
        label: services.label,
        icon: services.icon,
      },
      servedByAdmin: {
        username: admins.username,
      },
    })
    .from(visits)
    .innerJoin(services, eq(visits.serviceId, services.id))
    .leftJoin(admins, eq(visits.servedBy, admins.id))
    .where(eq(visits.id, id))
    .limit(1);

  if (!row) return null;
  let destinationService: { code: string; label: string } | null = null;
  if (row.destinationServiceId) {
    const [destination] = await db
      .select({ code: services.code, label: services.label })
      .from(services)
      .where(eq(services.id, row.destinationServiceId))
      .limit(1);
    destinationService = destination ?? null;
  }
  return { ...row, destinationService };
}

// ─── Mark scanned (HP pasien buka URL) ────────────────────────────────────────
export async function markScanned(id: string, userAgent: string, deviceId: string) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [visit] = await tx
      .select({ deviceId: visits.deviceId })
      .from(visits)
      .where(eq(visits.id, id))
      .limit(1)
      .for("update");

    if (!visit) throw new Error("Visit not found");
    if (visit.deviceId && visit.deviceId !== deviceId) {
      throw new Error("QR_ALREADY_SCANNED");
    }

    const [otherActiveVisit] = await tx
      .select({ id: visits.id })
      .from(visits)
      .where(
        and(
          eq(visits.deviceId, deviceId),
          eq(visits.status, "waiting"),
          ne(visits.id, id),
        ),
      )
      .limit(1);

    if (otherActiveVisit) throw new Error("DEVICE_LOCKED");

    if (!visit.deviceId) {
      await tx
        .update(visits)
        .set({ deviceId, scannedAt: new Date(), scannedUa: userAgent })
        .where(eq(visits.id, id));
    }
  });

  return getVisitById(id);
}

// ─── Mark served ──────────────────────────────────────────────────────────────
export async function markServed(id: string, adminId: number) {
  const db = getDb();
  const visit = await getVisitById(id);
  if (!visit) throw new Error("Visit not found");

  if (visit.status === "revoked") {
    return { success: false, reason: "REVOKED", visit };
  }
  if (visit.status === "served") {
    return { success: false, reason: "ALREADY_SERVED", visit };
  }

  // Conditional update: a concurrent scan / Simpan RM that got here first wins, this one reports it.
  const [result] = await db
    .update(visits)
    .set({ status: "served", servedAt: new Date(), servedBy: adminId })
    .where(and(eq(visits.id, id), eq(visits.status, "waiting")));
  const latest = await getVisitById(id);
  if (result.affectedRows === 0) {
    return { success: false, reason: latest?.status === "revoked" ? "REVOKED" : "ALREADY_SERVED", visit: latest ?? visit };
  }

  return { success: true, reason: null, visit: latest };
}

// ─── Mark revoked ─────────────────────────────────────────────────────────────
export async function revokeVisit(id: string) {
  const db = getDb();
  await db
    .update(visits)
    .set({ status: "revoked" })
    .where(eq(visits.id, id));
}

// ─── Delete visit ─────────────────────────────────────────────────────────────
export async function deleteVisit(id: string) {
  const db = getDb();
  await db.delete(visits).where(eq(visits.id, id));
}

// ─── List visits (admin) ──────────────────────────────────────────────────────
export interface VisitFilters {
  status?: VisitStatus;
  serviceCode?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}

function visitConditions(filters?: VisitFilters) {
  const conditions = [];
  if (filters?.status) conditions.push(eq(visits.status, filters.status));
  if (filters?.serviceCode) conditions.push(eq(services.code, filters.serviceCode));
  if (filters?.dateFrom) conditions.push(gte(visits.createdAt, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(visits.createdAt, filters.dateTo));
  if (filters?.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(or(like(visits.id, pattern), like(visits.notes, pattern), like(services.label, pattern))!);
  }
  return conditions;
}

export async function listVisits(filters?: VisitFilters & { limit?: number; offset?: number }) {
  const db = getDb();
  const conditions = visitConditions(filters);

  const query = db
    .select({
      id: visits.id,
      status: visits.status,
      createdAt: visits.createdAt,
      scannedAt: visits.scannedAt,
      servedAt: visits.servedAt,
      notes: visits.notes,
      queueNumber: visits.queueNumber,
      service: {
        code: services.code,
        label: services.label,
        icon: services.icon,
      },
      servedByAdmin: {
        username: admins.username,
      },
    })
    .from(visits)
    .innerJoin(services, eq(visits.serviceId, services.id))
    .leftJoin(admins, eq(visits.servedBy, admins.id))
    .orderBy(desc(visits.createdAt))
    .limit(filters?.limit ?? 100)
    .offset(filters?.offset ?? 0);

  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  return query;
}

export async function countVisits(filters?: VisitFilters) {
  const conditions = visitConditions(filters);

  const query = getDb()
    .select({ total: count() })
    .from(visits)
    .innerJoin(services, eq(visits.serviceId, services.id));
  const [row] = conditions.length ? await query.where(and(...conditions)) : await query;
  return Number(row?.total ?? 0);
}

// ─── Daily queue number ──────────────────────────────────────────────────────
/** 1-based order of a visit among all visits created on the same day (ULID ids sort by time). */
export async function getDailyQueueNumber(visit: { id: string; createdAt: Date; notes?: string | null; queueNumber?: string | null }) {
  if (visit.queueNumber) return visit.queueNumber;
  // Tickets created before migration 0016 have no stored number.
  if (visit.notes?.startsWith(OFFLINE_NOTE_PREFIX)) return visit.notes.slice(OFFLINE_NOTE_PREFIX.length);
  const mlite = parseMliteNote(visit.notes);
  if (mlite) return mlite.queueNumber;
  const db = getDb();
  const dayStart = new Date(visit.createdAt);
  dayStart.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ total: count(visits.id) })
    .from(visits)
    .where(
      and(
        gte(visits.createdAt, dayStart),
        lte(visits.id, visit.id),
        // Offline and mLITE tickets have their own numbers; counting them would shift the app's printed numbers.
        or(
          isNull(visits.notes),
          and(notLike(visits.notes, `${OFFLINE_NOTE_PREFIX}%`), notLike(visits.notes, `${MLITE_NOTE_PREFIX}%`)),
        ),
      ),
    );
  return String(row?.total ?? 0).padStart(3, "0");
}

// ─── Daily stats ──────────────────────────────────────────────────────────────
export async function getDailyStats() {
  const db = getDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const rows = await db
    .select({
      serviceCode: services.code,
      serviceLabel: services.label,
      total: count(visits.id),
      waiting: sql<number>`SUM(CASE WHEN ${visits.status} = 'waiting' THEN 1 ELSE 0 END)`,
      served: sql<number>`SUM(CASE WHEN ${visits.status} = 'served' THEN 1 ELSE 0 END)`,
      revoked: sql<number>`SUM(CASE WHEN ${visits.status} = 'revoked' THEN 1 ELSE 0 END)`,
    })
    .from(visits)
    .innerJoin(services, eq(visits.serviceId, services.id))
    .where(and(gte(visits.createdAt, today), lte(visits.createdAt, tomorrow)))
    .groupBy(services.code, services.label);

  return rows;
}

// ─── Get all services ─────────────────────────────────────────────────────────
export async function getAllServices() {
  const db = getDb();
  return db
    .select()
    .from(services)
    .where(
      and(
        eq(services.isActive, true),
        or(notLike(services.code, "poli_%"), eq(services.code, "poli_umum")),
      ),
    );
}

export async function getAdminServices() {
  return getDb().select().from(services).orderBy(services.id);
}

export async function createPoliService(code: string, label: string) {
  const normalizedCode = code.trim().toLowerCase();
  const normalizedLabel = label.trim();
  if (!/^poli_[a-z0-9_]+$/.test(normalizedCode)) throw new Error("INVALID_POLI_CODE");
  if (!normalizedLabel || normalizedLabel.length > 100) throw new Error("INVALID_POLI_LABEL");

  await getDb().insert(services).values({
    code: normalizedCode,
    label: normalizedLabel,
    icon: "Stethoscope",
    isActive: true,
    createdAt: new Date(),
  });
}

export async function updatePoliService(id: number, label: string, isActive: boolean) {
  const normalizedLabel = label.trim();
  if (!normalizedLabel || normalizedLabel.length > 100) throw new Error("INVALID_POLI_LABEL");

  const [service] = await getDb()
    .select({ code: services.code })
    .from(services)
    .where(eq(services.id, id))
    .limit(1);
  if (!service?.code.startsWith("poli_")) throw new Error("POLI_NOT_FOUND");

  await getDb()
    .update(services)
    .set({ label: normalizedLabel, isActive })
    .where(eq(services.id, id));
}
