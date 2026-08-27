import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getCookie, getRequestHeaders, setCookie } from "@tanstack/start-server-core";
import { nanoid } from "nanoid";
import { VisitDetail } from "~/components/visit/VisitDetail";
import { markScanned } from "~/server/functions/visits";
import { getBarcodeEnabled } from "~/server/functions/settings";
import type { getVisitById } from "~/server/functions/visits";

type VisitData = NonNullable<Awaited<ReturnType<typeof getVisitById>>>;

const loadVisitAction = createServerFn({ method: "GET" })
  .validator((d: { visitId: string }) => d)
  .handler(async ({ data }): Promise<VisitData> => {
    if (!(await getBarcodeEnabled())) throw new Error("BARCODE_DISABLED");
    const headers = getRequestHeaders();
    const ua = (headers as any)["user-agent"] ?? "unknown";
    let deviceId = getCookie("patient_device_id");
    if (!deviceId) {
      deviceId = nanoid();
      setCookie("patient_device_id", deviceId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }
    const visit = await markScanned(data.visitId, ua, deviceId);
    if (!visit) throw new Error("Visit not found");
    return visit;
  });

export const Route = createFileRoute("/visit/$visitId")({
  loader: async ({ params }): Promise<VisitData> => {
    return loadVisitAction({ data: { visitId: (params as any).visitId } });
  },
  component: VisitPage,
  errorComponent: ScanErrorPage,
});

function ScanErrorPage() {
  return (
    <main className="min-h-dvh grid place-items-center bg-red-50 px-6 text-center">
      <div className="max-w-md rounded-3xl border-2 border-red-200 bg-white p-8 shadow-lg">
        <div className="text-5xl" aria-hidden>⛔</div>
        <h1 className="mt-4 text-2xl font-bold text-red-800">QR Tidak Dapat Digunakan</h1>
        <p className="mt-2 text-red-700">
          Tiket ini sudah dipindai oleh perangkat lain atau perangkat ini masih memiliki tiket aktif.
        </p>
      </div>
    </main>
  );
}

function VisitPage() {
  const visit = Route.useLoaderData() as VisitData;
  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.APP_URL ?? "http://localhost:3000");

  if (visit.service.code === "registrasi") {
    return (
      <main className="min-h-dvh grid place-items-center bg-amber-50 px-6 text-center">
        <section className="max-w-md rounded-3xl border-2 border-amber-200 bg-white p-8 shadow-lg">
          <h1 className="text-2xl font-bold text-amber-900">Check-in BPJS dilakukan di kiosk</h1>
          <p className="mt-3 text-amber-800">
            Kembali ke mesin kiosk untuk verifikasi pasien dan Frista.
          </p>
        </section>
      </main>
    );
  }
  return <VisitDetail visit={visit as any} appUrl={appUrl} />;
}
