import { createServerFn } from "@tanstack/react-start";
import {
  setAutoPrintEnabled,
  setBarcodeEnabled,
  setBookingScannerEnabled,
  setFristaBypassEnabled,
  setDisplayYoutubePlaylist,
  setKioskReturnSeconds,
  setShowBpjsTestAccounts,
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

export const updateDisplayPlaylistAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; playlist: string }) => {
    // One playlist URL/ID, or several video URLs/IDs separated by commas or new lines.
    // Stored as IDs only: a playlist ID, or comma-joined 11-char video IDs.
    const ids = data.playlist
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(
        (raw) =>
          raw.match(/[?&]list=([^&#]+)/)?.[1] ??
          raw.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/)?.[1] ??
          raw,
      );
    const valid =
      ids.length <= 1
        ? ids.every((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id))
        : ids.every((id) => /^[A-Za-z0-9_-]{11}$/.test(id));
    const playlist = ids.join(",");
    if (!valid || playlist.length > 255) throw new Error("DISPLAY_PLAYLIST_INVALID");
    return { token: data.token, playlist };
  })
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    await setDisplayYoutubePlaylist(data.playlist);
    return { ok: true };
  });

export const updateBpjsTestAccountsSettingAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; enabled: boolean }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    await setShowBpjsTestAccounts(data.enabled);
    return { ok: true };
  });
