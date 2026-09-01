import { createServerFn } from "@tanstack/react-start";
import { createPoliService, updatePoliService } from "../functions/visits";
import { requireAdminToken } from "./admin-auth";

export const createPoliAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; code: string; label: string }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    await createPoliService(data.code, data.label);
    return { ok: true };
  });

export const updatePoliAction = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: number; label: string; isActive: boolean }) => data)
  .handler(async ({ data }) => {
    requireAdminToken(data.token, true);
    await updatePoliService(data.id, data.label, data.isActive);
    return { ok: true };
  });
