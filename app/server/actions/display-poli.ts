import { createServerFn } from "@tanstack/react-start";
import { getPoliBoard, listPoliCalls, pollPoliCalls } from "../functions/display-poli";
import { getPoliDisplayTest } from "../functions/display-test";
import { getDisplayYoutubePlaylist, getPrayerSettings } from "../functions/settings";
import { requireAdminToken } from "./admin-auth";

/** Public poli TV feed (test mode: SIMRS antripoli is only read). Without `afterId` it returns state only. */
export const getDisplayPoliAction = createServerFn({ method: "GET" })
  .validator((data: { afterId?: number }) => data)
  .handler(async ({ data }) => {
    const [{ calls, lastCall, cursor, rows }, playlist, prayer] = await Promise.all([
      pollPoliCalls(data.afterId),
      getDisplayYoutubePlaylist(),
      getPrayerSettings(),
    ]);
    const board = await getPoliBoard(rows);
    const responsiveVoiceKey = process.env.VITE_RESPONSIVEVOICE_KEY_POLI || process.env.RESPONSIVEVOICE_KEY || process.env.VITE_RESPONSIVEVOICE_KEY || "";
    // Age by the server clock (the TV clock may be off): lets a reloaded TV finish a call it cut off.
    const lastCallAgeMs = lastCall?.calledAt ? Date.now() - lastCall.calledAt.getTime() : null;
    return { calls, lastCall, lastCallAgeMs, cursor, board, playlist, prayer, responsiveVoiceKey, test: getPoliDisplayTest() };
  });

export type DisplayPoliData = Awaited<ReturnType<typeof getDisplayPoliAction>>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Admin "Riwayat Panggilan Poli": every poli call of one day (any logged-in petugas). */
export const listPoliCallsAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; date: string }) => {
    if (!DATE_RE.test(data.date)) throw new Error("DATE_INVALID");
    return data;
  })
  .handler(async ({ data }) => {
    requireAdminToken(data.token);
    return listPoliCalls(data.date);
  });

export type PoliCallHistory = Awaited<ReturnType<typeof listPoliCallsAction>>;
