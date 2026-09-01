import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/start-server-core";
import { checkInBpjsBooking, lookupBpjsBooking } from "../functions/bpjs";
import { getBookingScannerEnabled, getFristaBypassEnabled } from "../functions/settings";
import { createVisit, getAllServices } from "../functions/visits";
import type { Service } from "../schema";
import { kioskErrorMessage } from "./kiosk-errors";

type Input =
  | { action: "services" }
  | { action: "lookup"; bookingCode?: string; cardNumber: string }
  | { action: "checkin"; bookingCode: string; cardNumber: string; source: "manual" | "qr" }
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
};

export const kioskAction = createServerFn({ method: "POST" })
  .validator((data: Input) => data)
  .handler(async ({ data }) => {
    if (data.action === "services") {
      const [services, fristaBypassEnabled, bookingScannerEnabled] = await Promise.all([
        getAllServices(),
        getFristaBypassEnabled(),
        getBookingScannerEnabled(),
      ]);
      let generalPatientUrl: string | null = null;
      try {
        const url = new URL(process.env.MLITE_GENERAL_PATIENT_URL ?? "");
        if (url.protocol === "http:" || url.protocol === "https:") generalPatientUrl = url.toString();
      } catch {}
      return { services, fristaBypassEnabled, bookingScannerEnabled, generalPatientUrl };
    }
    if (data.action === "lookup") {
      try {
        return { ok: true as const, booking: await lookupBpjsBooking(data.cardNumber, data.bookingCode) };
      } catch (error) {
        return { ok: false as const, message: kioskErrorMessage(error, "SIMRS_UNAVAILABLE") };
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
