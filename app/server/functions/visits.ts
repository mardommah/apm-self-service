"use server";

import { eq, and, desc, gte, lte, count, sql } from "drizzle-orm";
import { getDb } from "../db";
import { visits, services, admins } from "../schema";
import { ulid } from "~/lib/ulid";
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

// ─── Create visit ─────────────────────────────────────────────────────────────
export async function createVisit(deviceId: string, serviceCode: string) {
  const db = getDb();

  // Fetch service
  const [service] = await db
    .select()
    .from(services)
    .where(and(eq(services.code, serviceCode), eq(services.isActive, true)))
    .limit(1);

  if (!service) throw new Error(`Service '${serviceCode}' not found`);

  // Double-check device lock
  const existing = await getActiveVisitByDevice(deviceId);
  if (existing) {
    throw new Error("DEVICE_LOCKED");
  }

  const id = ulid();
  await db.insert(visits).values({
    id,
    serviceId: service.id,
    deviceId,
    status: "waiting",
    createdAt: new Date(),
  });

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

  return row ?? null;
}

// ─── Mark scanned (HP pasien buka URL) ────────────────────────────────────────
export async function markScanned(id: string, userAgent: string) {
  const db = getDb();
  const visit = await getVisitById(id);
  if (!visit) throw new Error("Visit not found");

  // Only update if not yet scanned
  if (!visit.scannedAt) {
    await db
      .update(visits)
      .set({ scannedAt: new Date(), scannedUa: userAgent })
      .where(eq(visits.id, id));
  }

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
export async function listVisits(filters?: {
  status?: VisitStatus;
  serviceCode?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}) {
  const db = getDb();
  const conditions = [];

  if (filters?.status) {
    conditions.push(eq(visits.status, filters.status));
  }
  if (filters?.serviceCode) {
    conditions.push(eq(services.code, filters.serviceCode));
  }
  if (filters?.dateFrom) {
    conditions.push(gte(visits.createdAt, filters.dateFrom));
  }
  if (filters?.dateTo) {
    conditions.push(lte(visits.createdAt, filters.dateTo));
  }

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
  return db.select().from(services).where(eq(services.isActive, true));
}
