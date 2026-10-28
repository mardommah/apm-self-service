import { createServerFn } from "@tanstack/react-start";
import {
  setAutoPrintEnabled,
  setBarcodeEnabled,
  setBookingScannerEnabled,
  setFristaBypassEnabled,
  setKioskReturnSeconds,
} from "../functions/settings";
import { requireAdminToken } from "./admin-auth";

export const updateBarcodeSettingAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; enabled: boolean }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    await setBarcodeEnabled(data.enabled);
    return { ok: true };
  });

export const updateAutoPrintSettingAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; enabled: boolean }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    await setAutoPrintEnabled(data.enabled);
    return { ok: true };
  });

export const updateKioskReturnSecondsAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; seconds: number }) => {
    if (!Number.isInteger(data.seconds) || data.seconds < 5 || data.seconds > 600) {
      throw new Error("KIOSK_RETURN_SECONDS_INVALID");
    }
    return data;
  })
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    await setKioskReturnSeconds(data.seconds);
    return { ok: true };
  });

export const updateBookingScannerSettingAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; enabled: boolean }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    await setBookingScannerEnabled(data.enabled);
    return { ok: true };
  });

export const updateFristaBypassSettingAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; enabled: boolean }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    await setFristaBypassEnabled(data.enabled);
    return { ok: true };
  });
