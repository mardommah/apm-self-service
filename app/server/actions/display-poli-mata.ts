import { createServerFn } from "@tanstack/react-start";
import { getOperasiToday, getPoliMataCalled, POLI_MATA_KD } from "../functions/display-poli-mata";
import { pollPoliCalls, todayWita } from "../functions/display-poli";
import { getPoliDisplayTest } from "../functions/display-test";
import { getDisplayYoutubePlaylist, getPrayerSettings } from "../functions/settings";

/** Public Poli Mata TV feed: Poli Mata calls (same detector as /display-poli), patients called before, today's operations. */
export const getDisplayPoliMataAction = createServerFn({ method: "GET" })
  .validator((data: { afterId?: number }) => data)
  .handler(async ({ data }) => {
    const date = todayWita();
    const [{ calls, lastCall, cursor }, operasi, playlist, prayer] = await Promise.all([
      pollPoliCalls(data.afterId, POLI_MATA_KD),
      getOperasiToday(date),
      getDisplayYoutubePlaylist(),
      getPrayerSettings(),
    ]);
    const called = await getPoliMataCalled(lastCall);
    const responsiveVoiceKey = process.env.VITE_RESPONSIVEVOICE_KEY_MATA || process.env.RESPONSIVEVOICE_KEY || process.env.VITE_RESPONSIVEVOICE_KEY || "";
    const lastCallAgeMs = lastCall?.calledAt ? Date.now() - lastCall.calledAt.getTime() : null;
    return { calls, lastCall, lastCallAgeMs, cursor, called, operasi, playlist, prayer, responsiveVoiceKey, test: getPoliDisplayTest() };
  });

export type DisplayPoliMataData = Awaited<ReturnType<typeof getDisplayPoliMataAction>>;
