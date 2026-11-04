import { createFileRoute } from "@tanstack/react-router";
import { DisplayKamarScreen } from "~/components/display/DisplayKamarScreen";
import { getDisplayKamarAction, type DisplayKamarData } from "~/server/actions/display-kamar";

export const Route = createFileRoute("/display-kamar")({
  // SIMRS down on first load: render the screen anyway, it keeps polling.
  loader: () => getDisplayKamarAction().catch((error) => (console.error("[display-kamar]", error), null)),
  component: () => <DisplayKamarScreen initial={Route.useLoaderData() as DisplayKamarData | null} />,
});
