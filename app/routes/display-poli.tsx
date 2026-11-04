import { createFileRoute } from "@tanstack/react-router";
import { DisplayPoliScreen } from "~/components/display/DisplayPoliScreen";
import { getDisplayPoliAction, type DisplayPoliData } from "~/server/actions/display-poli";

export const Route = createFileRoute("/display-poli")({
  head: () => ({ meta: [{ title: "Display Antrean Poli · Klinik Syamsinar" }] }),
  // SIMRS down on first load: render the screen anyway, it keeps polling.
  loader: () => getDisplayPoliAction({ data: {} }).catch((error) => (console.error("[display-poli]", error), null)),
  component: () => <DisplayPoliScreen initial={Route.useLoaderData() as DisplayPoliData | null} />,
});
