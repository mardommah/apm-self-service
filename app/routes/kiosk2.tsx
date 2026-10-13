import { createFileRoute } from "@tanstack/react-router";
import { KioskScreen, getServicesAction } from "~/components/kiosk/KioskScreen";
import type { KioskData } from "~/server/actions/kiosk";

export const Route = createFileRoute("/kiosk2")({
  loader: (): Promise<KioskData> => getServicesAction(),
  component: () => <KioskScreen data={Route.useLoaderData() as KioskData} bpjsDirectPrint />,
});
