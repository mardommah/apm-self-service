import { createFileRoute } from "@tanstack/react-router";
import { KioskScreen, getServicesAction } from "~/components/kiosk/KioskScreen";
import type { KioskData } from "~/server/actions/kiosk";
import { cacheKioskData, getCachedKioskData } from "~/lib/offline-kiosk";

export const Route = createFileRoute("/kiosk2")({
  // Offline: fall back to the last services/settings this kiosk loaded.
  loader: (): Promise<KioskData> =>
    getServicesAction().then(cacheKioskData, (error) => getCachedKioskData() ?? Promise.reject(error)),
  component: () => <KioskScreen data={Route.useLoaderData() as KioskData} bpjsDirectPrint />,
});
