import {
  mysqlTable,
  varchar,
  text,
  boolean,
  datetime,
  int,
  mysqlEnum,
  index,
  uniqueIndex,
  serial,
  date,
} from "drizzle-orm/mysql-core";
import { relations, sql } from "drizzle-orm";

// ─── Services ────────────────────────────────────────────────────────────────
export const services = mysqlTable("services", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).unique().notNull(),
  label: varchar("label", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  isActive: boolean("is_active").default(true).notNull(),
  // Ticket prefix for mLITE services (A = antrean Loket, B = antrean CS); null for app-numbered services.
  queuePrefix: mysqlEnum("queue_prefix", ["A", "B"]),
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

// ─── Application settings ───────────────────────────────────────────────────
export const appSettings = mysqlTable("app_settings", {
  id: int("id").primaryKey(),
  barcodeEnabled: boolean("barcode_enabled").default(false).notNull(),
  bookingScannerEnabled: boolean("booking_scanner_enabled").default(false).notNull(),
  fristaBypassEnabled: boolean("frista_bypass_enabled").default(false).notNull(),
  autoPrintEnabled: boolean("auto_print_enabled").default(true).notNull(),
  kioskReturnSeconds: int("kiosk_return_seconds").default(30).notNull(),
  displayYoutubePlaylist: varchar("display_youtube_playlist", { length: 255 }).default("").notNull(),
  showBpjsTestAccounts: boolean("show_bpjs_test_accounts").default(true).notNull(),
  updatedAt: datetime("updated_at").default(new Date()).notNull(),
});

// ─── Visits ───────────────────────────────────────────────────────────────────
export const visits = mysqlTable(
  "visits",
  {
    id: varchar("id", { length: 26 }).primaryKey(), // ULID
    serviceId: int("service_id").notNull(),
    destinationServiceId: int("destination_service_id"),
    patientStatus: mysqlEnum("patient_status", ["baru", "lama"]),
    deviceId: varchar("device_id", { length: 255 }),
    status: mysqlEnum("status", ["waiting", "served", "revoked"])
      .default("waiting")
      .notNull(),
    createdAt: datetime("created_at").default(new Date()).notNull(),
    scannedAt: datetime("scanned_at"),
    scannedUa: text("scanned_ua"),
    servedAt: datetime("served_at"),
    servedBy: int("served_by"),
    notes: text("notes"),
    // Printed number, fixed at creation ("A001" mLITE, "C001" app, "O001" offline). Null for tickets made before migration 0016.
    queueNumber: varchar("queue_number", { length: 8 }),
    // Day of the ticket, only for the unique key below (migration 0017).
    queueDate: date("queue_date").generatedAlwaysAs(sql`DATE(created_at)`, { mode: "stored" }),
  },
  (table) => ({
    queueNumberUnique: uniqueIndex("uq_visits_queue_date_number").on(table.queueDate, table.queueNumber),
    deviceStatusIdx: index("idx_device_status").on(table.deviceId, table.status),
    createdAtIdx: index("idx_created_at").on(table.createdAt),
    serviceIdx: index("idx_service_id").on(table.serviceId),
  })
);

export const queueCalls = mysqlTable(
  "queue_calls",
  {
    id: int("id").autoincrement().primaryKey(),
    visitId: varchar("visit_id", { length: 26 }).notNull(),
    loket: int("loket").notNull(),
    isRecall: boolean("is_recall").default(false).notNull(),
    calledAt: datetime("called_at").notNull(),
    finishedAt: datetime("finished_at"),
  },
  (table) => ({
    calledAtIdx: index("idx_queue_calls_called_at").on(table.calledAt),
    visitIdx: index("idx_queue_calls_visit").on(table.visitId),
  })
);

export const bpjsWorkflows = mysqlTable(
  "bpjs_kiosk_workflows",
  {
    visitId: varchar("visit_id", { length: 26 }).primaryKey(),
    state: mysqlEnum("state", [
      "created",
      "patient_verified",
      "biometric_required",
      "frista_running",
      "biometric_verified",
      "checked_in",
      "sep_issued",
      "completed",
      "cancelled",
      "requires_staff",
    ]).default("created").notNull(),
    cardLast4: varchar("card_last4", { length: 4 }),
    cardHash: varchar("card_hash", { length: 64 }),
    nikHash: varchar("nik_hash", { length: 64 }),
    noRm: varchar("no_rm", { length: 32 }),
    patientName: varchar("patient_name", { length: 150 }),
    bookingCode: varchar("booking_code", { length: 100 }),
    queueNumber: varchar("queue_number", { length: 50 }),
    noRawat: varchar("no_rawat", { length: 50 }),
    noSep: varchar("no_sep", { length: 100 }),
    lastErrorCode: varchar("last_error_code", { length: 80 }),
    retryCount: int("retry_count").default(0).notNull(),
    biometricVerifiedAt: datetime("biometric_verified_at"),
    checkedInAt: datetime("checked_in_at"),
    createdAt: datetime("created_at").default(new Date()).notNull(),
    updatedAt: datetime("updated_at").default(new Date()).notNull(),
  },
  (table) => ({
    stateIdx: index("idx_bpjs_workflow_state").on(table.state),
    cardHashIdx: index("idx_bpjs_workflow_card_hash").on(table.cardHash),
  }),
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
export type BpjsWorkflow = typeof bpjsWorkflows.$inferSelect;
export type BpjsWorkflowState = BpjsWorkflow["state"];

export type VisitStatus = "waiting" | "served" | "revoked";
export type AdminRole = "admin" | "security";
export type ServiceCode =
  | "registrasi"
  | "poli_umum"
  | "vaksinasi"
  | "igd"
  | "laboratorium";
