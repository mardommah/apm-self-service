"use server";

import { eq, and, desc, gte, lte, count, sql, ne, like, notLike, or, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { visits, services, admins } from "../schema";
import { ulid } from "~/lib/ulid";
import { createGeneralLoketQueue } from "../simrs";
import type { VisitStatus } from "../schema";

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
// BPJS & Umum tickets are also rows in SIMRS mlite_antrian_loket (type "Loket"): "mlite:<kd>:<number>", e.g. "mlite:9600:A7".
const MLITE_NOTE_PREFIX = "mlite:";
export const LOKET_SERVICE_CODES = ["registrasi", "poli_umum"];

export function parseMliteNote(notes: string | null | undefined) {
  const match = notes?.match(/^mlite:(\d+):([A-Z])(\d+)$/);
  return match ? { kd: Number(match[1]), queueNumber: match[2] + match[3], noantrian: match[3] } : null;
}

async function createMliteNote() {
  try {
    const queue = await createGeneralLoketQueue(1);
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
  const mliteNote = !offline && LOKET_SERVICE_CODES.includes(service.code) ? await createMliteNote() : null;
  await db
    .insert(visits)
    .values({
      id,
      serviceId: service.id,
      destinationServiceId,
      patientStatus: registration?.patientStatus ?? null,
      deviceId: null,
      status: "waiting",
      createdAt: offline?.createdAt ?? new Date(),
      notes: offline ? OFFLINE_NOTE_PREFIX + offline.queueNumber : mliteNote,
    })
    // Re-syncing the same offline visit is a no-op.
    .onDuplicateKeyUpdate({ set: { id } });

  return { id, service };
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

  await db
    .update(visits)
    .set({ status: "served", servedAt: new Date(), servedBy: adminId })
    .where(eq(visits.id, id));

  return { success: true, reason: null, visit: await getVisitById(id) };
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
export async function getDailyQueueNumber(visit: { id: string; createdAt: Date; notes?: string | null }) {
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
