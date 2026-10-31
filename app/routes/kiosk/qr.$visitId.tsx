import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/start-server-core";
import { QRDisplay } from "~/components/kiosk/QRDisplay";
import { BpjsCheckin } from "~/components/visit/BpjsCheckin";
import { getDailyQueueNumber, getVisitById } from "~/server/functions/visits";
import { getBpjsWorkflow } from "~/server/functions/bpjs";
import { getAutoPrintEnabled, getBarcodeEnabled, getKioskReturnSeconds } from "~/server/functions/settings";
import type { BpjsWorkflow } from "~/server/schema";
import { getCachedKioskData, getOfflineVisit } from "~/lib/offline-kiosk";

type VisitDetail = NonNullable<Awaited<ReturnType<typeof getVisitById>>> & {
  bpjsWorkflow: BpjsWorkflow | null;
  queueNumber: string;
  barcodeEnabled: boolean;
  autoPrintEnabled: boolean;
  kioskReturnSeconds: number;
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
      queueNumber: await getDailyQueueNumber(visit),
      bpjsWorkflow: isBpjs ? await getBpjsWorkflow(visit.id) : null,
      barcodeEnabled: await getBarcodeEnabled(),
      autoPrintEnabled: await getAutoPrintEnabled(),
      kioskReturnSeconds: await getKioskReturnSeconds(),
    };
  });

export const Route = createFileRoute("/kiosk/qr/$visitId")({
  validateSearch: (search: Record<string, unknown>): { from?: "kiosk2" } =>
    search.from === "kiosk2" ? { from: "kiosk2" } : {},
  loader: async ({ params }): Promise<VisitDetail> => {
    const { visitId } = params as any;
    // Outbox first: an offline ticket shows instantly instead of waiting for an unreachable server.
    return offlineVisitDetail(visitId) ?? getVisitAction({ data: { visitId } });
  },
  component: QRPage,
});

/** Kiosk 2 ticket still in the offline outbox (server unreachable or not synced yet). */
function offlineVisitDetail(visitId: string): VisitDetail | null {
  const visit = getOfflineVisit(visitId);
  const data = getCachedKioskData();
  if (!visit || !data) return null;
  // Only the fields QRDisplay reads; the rest exist once the visit syncs.
  return {
    id: visit.id,
    status: "waiting",
    createdAt: new Date(visit.createdAt),
    queueNumber: visit.queueNumber,
    service: { code: visit.serviceCode, label: visit.serviceLabel, icon: "" },
    destinationService: null,
    bpjsWorkflow: null,
    barcodeEnabled: data.barcodeEnabled,
    autoPrintEnabled: data.autoPrintEnabled,
    kioskReturnSeconds: data.kioskReturnSeconds,
  } as VisitDetail;
}

function QRPage() {
  const visit = Route.useLoaderData() as VisitDetail;
  const navigate = useNavigate();
  const { from } = Route.useSearch();
  const homePath = from === "kiosk2" ? "/kiosk2" : "/";
  const appUrl = typeof window !== "undefined"
    ? window.location.origin
    : (process.env.APP_URL ?? "http://localhost:3000");

  const timeoutMs = visit.kioskReturnSeconds * 1000;

  function handleTimeout() {
    navigate({ to: homePath });
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
      queueNumber={visit.queueNumber}
      serviceLabel={visit.service.label}
      serviceCode={visit.service.code}
      patientStatus={visit.patientStatus}
      createdAt={visit.createdAt}
      status={visit.status}
      appUrl={appUrl}
      barcodeEnabled={visit.barcodeEnabled}
      autoPrintEnabled={visit.autoPrintEnabled}
      timeoutMs={timeoutMs}
      homePath={homePath}
      onTimeout={handleTimeout}
    />
  );
}
