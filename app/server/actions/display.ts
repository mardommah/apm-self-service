import { createServerFn } from "@tanstack/react-start";
import { finishQueueCall } from "../functions/call-finish";
import { createQueueCall, findVisitById, listCallsAfter, listLoketCalls } from "../functions/calls";
import { getDisplayYoutubePlaylist, getPrayerSettings } from "../functions/settings";
import { getPrayerTest } from "../functions/prayer-test";
import { requireAdminToken } from "./admin-auth";

export const callVisitAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; visitId: string; loket: number }) => {
    if (!Number.isInteger(data.loket) || data.loket < 1 || data.loket > 99) throw new Error("LOKET_INVALID");
    return data;
  })
  .handler(async ({ data }) => {
    requireAdminToken(data.token);
    const result = await createQueueCall(() => findVisitById(data.visitId), data.loket);
    if (!result) throw new Error("Visit not found");
    return result;
  });

export const finishVisitAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; visitId: string }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token);
    await finishQueueCall(data.visitId);
    return { ok: true };
  });

/** Public, read-only feed for the waiting-room TV. Without `afterId` it returns state only, no calls to announce. */
export const getDisplayAction = createServerFn({ method: "GET" })
  .validator((data: { afterId?: number }) => data)
  .handler(async ({ data }) => {
    const [lokets, calls, playlist, prayer] = await Promise.all([
      listLoketCalls(),
      data.afterId === undefined ? Promise.resolve([]) : listCallsAfter(data.afterId),
      getDisplayYoutubePlaylist(),
      getPrayerSettings(),
    ]);
    const lastCall = lokets.reduce<(typeof lokets)[number] | null>(
      (latest, call) => (!latest || call.id > latest.id ? call : latest),
      null,
    );
    const cursor = Math.max(data.afterId ?? 0, lastCall?.id ?? 0, ...calls.map((c) => c.id));
    return { lokets, calls, lastCall, cursor, playlist, prayer, prayerTest: getPrayerTest() };
  });

export type DisplayData = Awaited<ReturnType<typeof getDisplayAction>>;
