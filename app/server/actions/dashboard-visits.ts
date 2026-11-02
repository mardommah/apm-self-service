import { createServerFn } from "@tanstack/react-start";
import { markServed, revokeVisit } from "../functions/visits";
import { requireAdminToken } from "./admin-auth";

export const serveAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; visitId: string }) => data)
  .handler(async ({ data }) => {
    const payload = requireAdminToken(data.token);
    return markServed(data.visitId, payload.adminId);
  });

export const revokeAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; visitId: string }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token);
    await revokeVisit(data.visitId);
    return { ok: true };
  });

