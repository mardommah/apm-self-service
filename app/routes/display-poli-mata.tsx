import { createFileRoute } from "@tanstack/react-router";
import { DisplayPoliMataScreen } from "~/components/display/DisplayPoliMataScreen";
import { getDisplayPoliMataAction, type DisplayPoliMataData } from "~/server/actions/display-poli-mata";

export const Route = createFileRoute("/display-poli-mata")({
  head: () => ({ meta: [{ title: "Display Poli Mata & Operasi · Klinik Syamsinar" }] }),
  // SIMRS down on first load: render the screen anyway, it keeps polling.
  loader: () => getDisplayPoliMataAction({ data: {} }).catch((error) => (console.error("[display-poli-mata]", error), null)),
  component: () => <DisplayPoliMataScreen initial={Route.useLoaderData() as DisplayPoliMataData | null} />,
});
