import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core";
import { QRDisplay } from "~/components/kiosk/QRDisplay";
import { BpjsCheckin } from "~/components/visit/BpjsCheckin";
import { getVisitById } from "~/server/functions/visits";
import { getBpjsWorkflow } from "~/server/functions/bpjs";
import { getBarcodeEnabled } from "~/server/functions/settings";
import type { BpjsWorkflow } from "~/server/schema";

type VisitDetail = NonNullable<Awaited<ReturnType<typeof getVisitById>>> & {
  bpjsWorkflow: BpjsWorkflow | null;
  barcodeEnabled: boolean;
};

const getVisitAction = createServerFn({ method: "GET" })
  .validator((d: { visitId: string }) => d)
  .handler(async ({ data }): Promise<VisitDetail> => {
    const visit = await getVisitById(data.visitId);
    if (!visit) throw new Error("Visit not found");
    const isBpjs = visit.service.code === "registrasi" && !!visit.destinationService;
    if (isBpjs && getCookie("bpjs_kiosk_visit_id") !== visit.id) {
      throw new Error("BPJS_KIOSK_SESSION_MISMATCH");
    }
    return {
      ...visit,
      bpjsWorkflow: isBpjs ? await getBpjsWorkflow(visit.id) : null,
      barcodeEnabled: await getBarcodeEnabled(),
    };
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

  if (visit.service.code === "registrasi" && visit.destinationService) {
    return (
      <BpjsCheckin
        visitId={visit.id}
        patientStatus={visit.patientStatus}
        destinationLabel={visit.destinationService.label}
        initialWorkflow={visit.bpjsWorkflow}
      />
    );
  }

  return (
    <QRDisplay
      visitId={visit.id}
      serviceLabel={visit.service.label}
      serviceCode={visit.service.code}
      createdAt={visit.createdAt}
      status={visit.status}
      appUrl={appUrl}
      barcodeEnabled={visit.barcodeEnabled}
      timeoutMs={timeoutMs}
      onTimeout={handleTimeout}
    />
  );
}
