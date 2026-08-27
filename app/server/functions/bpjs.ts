"use server";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { getDb } from "../db";
import { bpjsWorkflows, services, visits } from "../schema";

export type PatientIdentity = {
  cardNumber: string;
  nik: string;
};

type MlitePatientResponse = {
  patient: { noRm: string; name: string };
  biometricRequired: boolean;
};

type MliteBiometricResponse = {
  verified: boolean;
  required: boolean;
  status?: string;
};

type MliteCheckInResponse = {
  bookingCode: string;
  queueNumber: string;
  noRawat: string;
  noSep?: string | null;
};

const terminalStates = new Set(["checked_in", "sep_issued", "completed"]);

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function validateIdentity(identity: PatientIdentity) {
  if (!/^\d{13}$/.test(identity.cardNumber)) {
    throw new Error("BPJS_CARD_INVALID");
  }
  if (!/^\d{16}$/.test(identity.nik)) throw new Error("NIK_INVALID");
}

function mliteConfig() {
  const baseUrl = process.env.MLITE_BASE_URL?.replace(/\/$/, "");
  const token = process.env.MLITE_API_TOKEN;
  if (!baseUrl || !token) throw new Error("MLITE_NOT_CONFIGURED");
  return { baseUrl, token };
}

async function mliteRequest<T>(path: string, body?: unknown): Promise<T> {
  const { baseUrl, token } = mliteConfig();
  const timeout = Number(process.env.MLITE_REQUEST_TIMEOUT_MS ?? 15_000);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new Error("MLITE_UNAVAILABLE");
  }

  const payload = await response.json().catch(() => null) as
    | (T & { error?: { code?: string }; message?: string })
    | null;
  if (!response.ok || !payload) {
    throw new Error(payload?.error?.code ?? "MLITE_REQUEST_FAILED");
  }
  return payload;
}

async function assertBpjsRegistrationVisit(visitId: string) {
  const db = getDb();
  const [visit] = await db
    .select({
      id: visits.id,
      status: visits.status,
      patientStatus: visits.patientStatus,
      destinationServiceId: visits.destinationServiceId,
      serviceCode: services.code,
    })
    .from(visits)
    .innerJoin(services, eq(visits.serviceId, services.id))
    .where(eq(visits.id, visitId))
    .limit(1);

  if (!visit) throw new Error("VISIT_NOT_FOUND");
  if (visit.serviceCode !== "registrasi" || !visit.destinationServiceId) {
    throw new Error("NOT_BPJS_REGISTRATION");
  }
  if (visit.status !== "waiting") throw new Error("VISIT_NOT_ACTIVE");
  const [destination] = await db
    .select({ code: services.code })
    .from(services)
    .where(eq(services.id, visit.destinationServiceId))
    .limit(1);
  if (!destination) throw new Error("DESTINATION_NOT_FOUND");
  return { ...visit, destinationServiceCode: destination.code };
}

export async function getBpjsWorkflow(visitId: string) {
  const db = getDb();
  const [workflow] = await db
    .select()
    .from(bpjsWorkflows)
    .where(eq(bpjsWorkflows.visitId, visitId))
    .limit(1);
  return workflow ?? null;
}

export async function identifyBpjsPatient(visitId: string, identity: PatientIdentity) {
  validateIdentity(identity);
  const visit = await assertBpjsRegistrationVisit(visitId);
  const db = getDb();
  const existing = await getBpjsWorkflow(visitId);
  if (existing && existing.state !== "created" && !existing.lastErrorCode) return existing;

  const now = new Date();
  await db
    .insert(bpjsWorkflows)
    .values({ visitId, state: "created", createdAt: now, updatedAt: now })
    .onDuplicateKeyUpdate({ set: { updatedAt: now, lastErrorCode: null } });

  try {
    const result = await mliteRequest<MlitePatientResponse>(
      `/internal/bpjs-kiosk/sessions/${encodeURIComponent(visitId)}/identify`,
      {
        nomorKartu: identity.cardNumber,
        nik: identity.nik,
        patientStatus: visit.patientStatus,
        destinationServiceCode: visit.destinationServiceCode,
      },
    );
    const state = result.biometricRequired ? "biometric_required" : "patient_verified";
    await db
      .update(bpjsWorkflows)
      .set({
        state,
        cardLast4: identity.cardNumber.slice(-4),
        cardHash: sha256(identity.cardNumber),
        nikHash: sha256(identity.nik),
        noRm: result.patient.noRm,
        patientName: result.patient.name,
        lastErrorCode: null,
        updatedAt: new Date(),
      })
      .where(eq(bpjsWorkflows.visitId, visitId));
  } catch (error) {
    const code = error instanceof Error ? error.message : "PATIENT_LOOKUP_FAILED";
    await db
      .update(bpjsWorkflows)
      .set({ lastErrorCode: code, updatedAt: new Date() })
      .where(eq(bpjsWorkflows.visitId, visitId));
    throw error;
  }
  return getBpjsWorkflow(visitId);
}

export async function createFristaJob(visitId: string, cardNumber: string) {
  if (!/^\d{13}$/.test(cardNumber)) throw new Error("BPJS_CARD_INVALID");
  const workflow = await getBpjsWorkflow(visitId);
  if (!workflow || workflow.state !== "biometric_required") {
    throw new Error("BIOMETRIC_NOT_REQUIRED");
  }
  if (!workflow.cardHash || !timingSafeEqual(Buffer.from(workflow.cardHash), Buffer.from(sha256(cardNumber)))) {
    throw new Error("PATIENT_MISMATCH");
  }
  const secret = process.env.FRISTA_AGENT_SHARED_SECRET;
  const agentUrl = process.env.FRISTA_AGENT_URL?.replace(/\/$/, "");
  if (!secret || secret.length < 32 || !agentUrl) throw new Error("FRISTA_AGENT_NOT_CONFIGURED");

  const payload = {
    visitId,
    cardHash: workflow.cardHash,
    exp: Math.floor(Date.now() / 1000) + 120,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  await getDb()
    .update(bpjsWorkflows)
    .set({ state: "frista_running", lastErrorCode: null, updatedAt: new Date() })
    .where(eq(bpjsWorkflows.visitId, visitId));
  return { agentUrl, token: `${encoded}.${signature}` };
}

export async function checkBpjsBiometric(visitId: string) {
  const workflow = await getBpjsWorkflow(visitId);
  if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
  if (terminalStates.has(workflow.state) || workflow.state === "biometric_verified") return workflow;

  const result = await mliteRequest<MliteBiometricResponse>(
    `/internal/bpjs-kiosk/sessions/${encodeURIComponent(visitId)}/biometric-status`,
  );
  const state = result.verified || !result.required ? "biometric_verified" : "biometric_required";
  await getDb()
    .update(bpjsWorkflows)
    .set({
      state,
      biometricVerifiedAt: state === "biometric_verified" ? new Date() : null,
      lastErrorCode: state === "biometric_required" ? "BIOMETRIC_NOT_VERIFIED" : null,
      updatedAt: new Date(),
    })
    .where(eq(bpjsWorkflows.visitId, visitId));
  return getBpjsWorkflow(visitId);
}

// DISABLED: Fitur check-in/SEP disembunyikan - tidak digunakan di UI
// Fungsi ini tetap ada untuk kompatibilitas, tetapi tidak dipanggil dari UI
export async function checkInBpjsPatient(visitId: string) {
  await assertBpjsRegistrationVisit(visitId);
  const workflow = await getBpjsWorkflow(visitId);
  if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
  if (terminalStates.has(workflow.state)) return workflow;
  if (!new Set(["patient_verified", "biometric_verified"]).has(workflow.state)) {
    throw new Error("BIOMETRIC_NOT_VERIFIED");
  }

  const result = await mliteRequest<MliteCheckInResponse>(
    `/internal/bpjs-kiosk/sessions/${encodeURIComponent(visitId)}/check-in`,
    { idempotencyKey: `apm:${visitId}:check-in` },
  );
  await getDb().transaction(async (tx) => {
    const [locked] = await tx
      .select({ state: bpjsWorkflows.state })
      .from(bpjsWorkflows)
      .where(eq(bpjsWorkflows.visitId, visitId))
      .for("update");
    if (!locked || terminalStates.has(locked.state)) return;
    await tx
      .update(bpjsWorkflows)
      .set({
        state: result.noSep ? "completed" : "checked_in",
        bookingCode: result.bookingCode,
        queueNumber: result.queueNumber,
        noRawat: result.noRawat,
        noSep: result.noSep ?? null,
        checkedInAt: new Date(),
        lastErrorCode: null,
        updatedAt: new Date(),
      })
      .where(and(eq(bpjsWorkflows.visitId, visitId), ne(bpjsWorkflows.state, "cancelled")));
  });
  return getBpjsWorkflow(visitId);
}
