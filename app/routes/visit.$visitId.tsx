import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/start-server-core";
import { VisitDetail } from "~/components/visit/VisitDetail";
import { markScanned } from "~/server/functions/visits";
import type { getVisitById } from "~/server/functions/visits";

type VisitData = NonNullable<Awaited<ReturnType<typeof getVisitById>>>;

const loadVisitAction = createServerFn({ method: "GET" })
  .validator((d: { visitId: string }) => d)
  .handler(async ({ data }): Promise<VisitData> => {
    const headers = getRequestHeaders();
    const ua = (headers as any)["user-agent"] ?? "unknown";
    const visit = await markScanned(data.visitId, ua);
    if (!visit) throw new Error("Visit not found");
    return visit;
  });

export const Route = createFileRoute("/visit/$visitId")({
  loader: async ({ params }): Promise<VisitData> => {
    return loadVisitAction({ data: { visitId: (params as any).visitId } });
  },
  component: VisitPage,
});

function VisitPage() {
  const visit = Route.useLoaderData() as VisitData;
  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.APP_URL ?? "http://localhost:3000");

  return <VisitDetail visit={visit as any} appUrl={appUrl} />;
}
