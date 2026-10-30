import { createServerFn } from "@tanstack/react-start";
import {
  countVisits,
  getAdminServices,
  getDailyQueueNumber,
  getDailyStats,
  listVisits,
} from "../functions/visits";
import {
  getAutoPrintEnabled,
  getBarcodeEnabled,
  getBookingScannerEnabled,
  getDisplayYoutubePlaylist,
  getFristaBypassEnabled,
  getKioskReturnSeconds,
} from "../functions/settings";
import type { VisitStatus } from "../schema";
import { requireAdminToken } from "./admin-auth";

export const getDashboardDataAction = createServerFn({ method: "GET" })
  .validator(
    (data: {
      token: string;
      status?: string;
      serviceCode?: string;
      dateFrom?: string; // YYYY-MM-DD, server local time
      dateTo?: string;
      search?: string;
      page?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const payload = requireAdminToken(data.token);
    const pageSize = 10;
    const page = Math.max(1, Math.floor(data.page ?? 1));
    const filters = {
      status: (data.status as VisitStatus) || undefined,
      serviceCode: data.serviceCode || undefined,
      dateFrom: data.dateFrom ? new Date(`${data.dateFrom}T00:00:00`) : undefined,
      dateTo: data.dateTo ? new Date(`${data.dateTo}T23:59:59.999`) : undefined,
      search: data.search?.trim() || undefined,
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
      getDisplayYoutubePlaylist(),
    ]);
    const [visitRows, totalVisits, stats, services] = results;
    const visits = await Promise.all(
      visitRows.map(async (v) => ({ ...v, queueNumber: await getDailyQueueNumber(v) })),
    );
    const [, , , , barcodeEnabled, bookingScannerEnabled, fristaBypassEnabled, autoPrintEnabled, kioskReturnSeconds, displayYoutubePlaylist] = results;
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
      displayYoutubePlaylist,
      admin: { username: payload.username, role: payload.role },
    };
  });
