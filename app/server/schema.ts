import {
  mysqlTable,
  varchar,
  text,
  boolean,
  datetime,
  int,
  mysqlEnum,
  index,
  serial,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// ─── Services ────────────────────────────────────────────────────────────────
export const services = mysqlTable("services", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: datetime("created_at").default(new Date()).notNull(),
});

// ─── Admins ───────────────────────────────────────────────────────────────────
export const admins = mysqlTable("admins", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 100 }).unique().notNull(),
  password: text("password").notNull(),
  role: mysqlEnum("role", ["admin", "security"]).default("admin").notNull(),
  createdAt: datetime("created_at").default(new Date()).notNull(),
  lastLogin: datetime("last_login"),
});

// ─── Visits ───────────────────────────────────────────────────────────────────
export const visits = mysqlTable(
  "visits",
  {
    id: varchar("id", { length: 26 }).primaryKey(), // ULID
    serviceId: int("service_id").notNull(),
    deviceId: varchar("device_id", { length: 255 }).notNull(),
    status: mysqlEnum("status", ["waiting", "served", "revoked"])
      .default("waiting")
      .notNull(),
    createdAt: datetime("created_at").default(new Date()).notNull(),
    scannedAt: datetime("scanned_at"),
    scannedUa: text("scanned_ua"),
    servedAt: datetime("served_at"),
    servedBy: int("served_by"),
    notes: text("notes"),
  },
  (table) => ({
    deviceStatusIdx: index("idx_device_status").on(table.deviceId, table.status),
    createdAtIdx: index("idx_created_at").on(table.createdAt),
    serviceIdx: index("idx_service_id").on(table.serviceId),
  })
);

// ─── Relations ────────────────────────────────────────────────────────────────
export const visitsRelations = relations(visits, ({ one }) => ({
  service: one(services, {
    fields: [visits.serviceId],
    references: [services.id],
  }),
  servedByAdmin: one(admins, {
    fields: [visits.servedBy],
    references: [admins.id],
  }),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  visits: many(visits),
}));

export const adminsRelations = relations(admins, ({ many }) => ({
  servedVisits: many(visits),
}));

// ─── Types ────────────────────────────────────────────────────────────────────
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type Visit = typeof visits.$inferSelect;
export type NewVisit = typeof visits.$inferInsert;
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;

export type VisitStatus = "waiting" | "served" | "revoked";
export type AdminRole = "admin" | "security";
export type ServiceCode =
  | "registrasi"
  | "poli_umum"
  | "igd"
  | "laboratorium";
