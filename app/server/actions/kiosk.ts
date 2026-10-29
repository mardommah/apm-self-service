import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/start-server-core";
import { checkInBpjsBooking, createFristaTestJob, lookupBpjsBooking } from "../functions/bpjs";
import {
  getAutoPrintEnabled,
  getBarcodeEnabled,
  getBookingScannerEnabled,
  getFristaBypassEnabled,
  getKioskReturnSeconds,
} from "../functions/settings";
import { createVisit, getAllServices } from "../functions/visits";
import { createGeneralLoketQueue, getGeneralLoketPreview } from "../simrs";
import type { Service } from "../schema";
import { kioskErrorMessage } from "./kiosk-errors";

type Input =
  | { action: "services" }
  | { action: "general-loket-queue"; loket: 1 | 2 }
  | { action: "general-loket-preview" }
  | { action: "lookup"; bookingCode?: string; identifier: string }
  | { action: "frista-test"; cardNumber: string }
  | { action: "checkin"; bookingCode: string; cardNumber: string; source: "manual" | "qr" }
  | { action: "sync"; visits: { id: string; serviceCode: string; createdAt: string; queueNumber: string }[] }
  | {
      action: "create";
      serviceCode: string;
      destinationServiceCode?: string;
      patientStatus?: "baru" | "lama";
    };

export type KioskData = {
  services: Service[];
  fristaBypassEnabled: boolean;
  bookingScannerEnabled: boolean;
  generalPatientUrl: string | null;
  // Cached by kiosk2 so offline tickets render like online ones.
  barcodeEnabled: boolean;
  autoPrintEnabled: boolean;
  kioskReturnSeconds: number;
};

export const kioskAction = createServerFn({ method: "POST" })
  .validator((data: Input) => data)
  .handler(async ({ data }) => {
    if (data.action === "services") {
      const [
        services,
        fristaBypassEnabled,
        bookingScannerEnabled,
        barcodeEnabled,
        autoPrintEnabled,
        kioskReturnSeconds,
      ] = await Promise.all([
        getAllServices(),
        getFristaBypassEnabled(),
        getBookingScannerEnabled(),
        getBarcodeEnabled(),
        getAutoPrintEnabled(),
        getKioskReturnSeconds(),
      ]);
      let generalPatientUrl: string | null = null;
      try {
        const url = new URL(process.env.MLITE_GENERAL_PATIENT_URL ?? "");
        if (url.protocol === "http:" || url.protocol === "https:") generalPatientUrl = url.toString();
      } catch {}
      return {
        services,
        fristaBypassEnabled,
        bookingScannerEnabled,
        generalPatientUrl,
        barcodeEnabled,
        autoPrintEnabled,
        kioskReturnSeconds,
      };
    }
    if (data.action === "sync") {
      const done: string[] = [];
      for (const visit of data.visits.slice(0, 200)) {
        const createdAt = Math.min(Date.parse(visit.createdAt), Date.now());
        const valid =
          /^[0-9A-HJKMNP-TV-Z]{26}$/.test(visit.id) &&
          /^O\d{3,}$/.test(visit.queueNumber) &&
          Date.now() - createdAt < 7 * 86_400_000;
        try {
          if (valid) {
            await createVisit(visit.serviceCode, undefined, {
              id: visit.id,
              createdAt: new Date(createdAt),
              queueNumber: visit.queueNumber,
            });
          } else {
            console.warn("Offline visit dropped (invalid):", visit.id);
          }
        } catch (error) {
          // DB errors propagate so the kiosk retries; an unknown service never succeeds, so drop it.
          if (!(error instanceof Error && error.message.startsWith("Service '"))) throw error;
          console.warn("Offline visit dropped (service not found):", visit.id);
        }
        done.push(visit.id);
      }
      return { done };
    }
    if (data.action === "general-loket-queue") {
      if (data.loket !== 1 && data.loket !== 2) {
        return { ok: false as const, message: "Loket tidak valid." };
      }
      try {
        return { ok: true as const, queue: await createGeneralLoketQueue(data.loket) };
      } catch {
        return { ok: false as const, message: "Nomor antrean loket belum dapat dibuat. Silakan coba lagi." };
      }
    }
    if (data.action === "general-loket-preview") {
      try {
        return { ok: true as const, preview: await getGeneralLoketPreview() };
      } catch {
        return { ok: false as const, message: "Nomor antrian loket belum dapat dimuat." };
      }
    }
    if (data.action === "lookup") {
      try {
        return { ok: true as const, booking: await lookupBpjsBooking(data.identifier, data.bookingCode) };
      } catch (error) {
        return {
          ok: false as const,
          code: error instanceof Error ? error.message : "SIMRS_UNAVAILABLE",
          message: kioskErrorMessage(error, "SIMRS_UNAVAILABLE"),
        };
      }
    }
    if (data.action === "frista-test") {
      try {
        return { ok: true as const, fristaJob: await createFristaTestJob(data.cardNumber) };
      } catch (error) {
        return { ok: false as const, message: kioskErrorMessage(error, "FRISTA_AGENT_FAILED") };
      }
    }
    if (data.action === "checkin") {
      try {
        const result = await checkInBpjsBooking(data.bookingCode, data.cardNumber, data.source);
        return { ok: true as const, ...result };
      } catch (error) {
        return { ok: false as const, message: kioskErrorMessage(error, "BPJS_FKTL_REQUEST_FAILED") };
      }
    }
    const registration =
      data.destinationServiceCode && data.patientStatus
        ? { destinationServiceCode: data.destinationServiceCode, patientStatus: data.patientStatus }
        : undefined;
    const result = await createVisit(data.serviceCode, registration);
    if (registration) {
      setCookie("bpjs_kiosk_visit_id", result.id, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 30,
      });
    }
    return result;
  });
