import { createServerFn } from "@tanstack/react-start";
import {
  countVisits,
  getAdminServices,
  getDailyStats,
  listVisits,
} from "../functions/visits";
import {
  getAutoPrintEnabled,
  getBarcodeEnabled,
  getBookingScannerEnabled,
  getFristaBypassEnabled,
  getKioskReturnSeconds,
} from "../functions/settings";
import type { VisitStatus } from "../schema";
import { requireAdminToken } from "./admin-auth";

export const getDashboardDataAction = createServerFn({ method: "GET" })
  .validator((data: { token: string; status?: string; serviceCode?: string; page?: number }) => data)
  .handler(async ({ data }) => {
    const payload = requireAdminToken(data.token);
    const pageSize = 10;
    const page = Math.max(1, Math.floor(data.page ?? 1));
    const filters = {
      status: (data.status as VisitStatus) || undefined,
      serviceCode: data.serviceCode || undefined,
    };
    const results = await Promise.all([
      listVisits({ ...filters, limit: pageSize, offset: (page - 1) * pageSize }),
      countVisits(filters),
      getDailyStats(),
      getAdminServices(),
      getBarcodeEnabled(),
      getBookingScannerEnabled(),
      getFristaBypassEnabled(),
      getAutoPrintEnabled(),
      getKioskReturnSeconds(),
    ]);
    const [visits, totalVisits, stats, services] = results;
    const [, , , , barcodeEnabled, bookingScannerEnabled, fristaBypassEnabled, autoPrintEnabled, kioskReturnSeconds] = results;
    return {
      visits,
      totalVisits,
      page,
      pageSize,
      stats,
      services,
      barcodeEnabled,
      bookingScannerEnabled,
      fristaBypassEnabled,
      autoPrintEnabled,
      kioskReturnSeconds,
      admin: { username: payload.username, role: payload.role },
    };
  });
