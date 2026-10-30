import { createServerFn } from "@tanstack/react-start";
import { createQueueCall } from "../functions/calls";
import { findNextVisit, findVisitByNumber, getLoketCallerState, saveVisitRm } from "../functions/loket-caller";
import { LOKET_SERVICE_CODES } from "../functions/visits";
import { requireAdminToken } from "./admin-auth";

type CallInput = { token: string; serviceCode: string; loket: number; number?: string };

function validateCall(data: CallInput) {
  if (!LOKET_SERVICE_CODES.includes(data.serviceCode)) throw new Error("SERVICE_INVALID");
  if (!Number.isInteger(data.loket) || data.loket < 1 || data.loket > 99) throw new Error("LOKET_INVALID");
  return data;
}

export const getLoketCallerAction = createServerFn({ method: "GET" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token);
    return getLoketCallerState();
  });

/** Without `number`: next waiting ticket. With `number`: jump to that ticket ("lompat"). */
export const callLoketAction = createServerFn({ method: "POST" })
  .validator(validateCall)
  .handler(async ({ data }) => {
    requireAdminToken(data.token);
    const visit = data.number
      ? await findVisitByNumber(data.serviceCode, data.number)
      : await findNextVisit(data.serviceCode);
    if (!visit) throw new Error(data.number ? "NUMBER_NOT_FOUND" : "QUEUE_EMPTY");
    return createQueueCall(visit.id, data.loket);
  });

export const saveRmAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; visitId: string; noRkmMedis: string }) => {
    const noRkmMedis = data.noRkmMedis.trim();
    // mLITE simpannorm rejects anything that is not exactly 6 characters.
    if (!/^\d{6}$/.test(noRkmMedis)) throw new Error("RM_INVALID");
    return { ...data, noRkmMedis };
  })
  .handler(async ({ data }) => {
    const payload = requireAdminToken(data.token);
    await saveVisitRm(data.visitId, data.noRkmMedis, payload.adminId);
    return { ok: true };
  });

export type LoketCallerState = Awaited<ReturnType<typeof getLoketCallerAction>>;
