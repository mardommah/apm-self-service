import { createFileRoute } from "@tanstack/react-router";
import { DisplayScreen } from "~/components/display/DisplayScreen";
import { getDisplayAction, type DisplayData } from "~/server/actions/display";

export const Route = createFileRoute("/display")({
  head: () => ({ meta: [{ title: "Display Antrean · Klinik Syamsinar" }] }),
  loader: () => getDisplayAction({ data: {} }),
  component: () => <DisplayScreen initial={Route.useLoaderData() as DisplayData} />,
});
