import { createFileRoute } from "@tanstack/react-router";
import { KioskScreen, getServicesAction } from "~/components/kiosk/KioskScreen";
import type { KioskData } from "~/server/actions/kiosk";
import { cacheKioskData, getCachedKioskData } from "~/lib/offline-kiosk";

export const Route = createFileRoute("/kiosk2")({
  // Cache-first: last services/settings render instantly (also offline); the fetch refreshes the cache for the next open.
  loader: (): Promise<KioskData> => {
    const cached = getCachedKioskData();
    const fresh = getServicesAction().then(cacheKioskData);
    if (!cached) return fresh;
    fresh.catch(() => {});
    return Promise.resolve(cached);
  },
  component: () => <KioskScreen data={Route.useLoaderData() as KioskData} bpjsDirectPrint />,
});
