import { createServerFn } from "@tanstack/react-start";
import {
  setAutoPrintEnabled,
  setBarcodeEnabled,
  setBookingScannerEnabled,
  setFristaBypassEnabled,
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
