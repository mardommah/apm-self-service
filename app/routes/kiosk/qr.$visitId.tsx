import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { QRDisplay } from "~/components/kiosk/QRDisplay";
import { getVisitById } from "~/server/functions/visits";

type VisitDetail = NonNullable<Awaited<ReturnType<typeof getVisitById>>>;

const getVisitAction = createServerFn({ method: "GET" })
  .validator((d: { visitId: string }) => d)
  .handler(async ({ data }): Promise<VisitDetail> => {
    const visit = await getVisitById(data.visitId);
    if (!visit) throw new Error("Visit not found");
    return visit;
  });

export const Route = createFileRoute("/kiosk/qr/$visitId")({
  loader: async ({ params }): Promise<VisitDetail> => {
    return getVisitAction({ data: { visitId: (params as any).visitId } });
  },
  component: QRPage,
});

function QRPage() {
  const visit = Route.useLoaderData() as VisitDetail;
  const navigate = useNavigate();
  const appUrl = typeof window !== "undefined"
    ? window.location.origin
    : (process.env.APP_URL ?? "http://localhost:3000");

  const timeoutMs = Number(process.env.KIOSK_TIMEOUT_MS ?? 300_000);

  function handleTimeout() {
    navigate({ to: "/" });
  }

  return (
    <QRDisplay
      visitId={visit.id}
      serviceLabel={visit.service.label}
      serviceCode={visit.service.code}
      appUrl={appUrl}
      timeoutMs={timeoutMs}
      onTimeout={handleTimeout}
    />
  );
}
