import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { ServiceCard } from "~/components/kiosk/ServiceCard";
import { getAllServices, createVisit, getActiveVisitByDevice } from "~/server/functions/visits";
import type { Service } from "~/server/schema";

// ─── Server functions ─────────────────────────────────────────────────────────
const getServicesAction = createServerFn({ method: "GET" })
  .handler(async (): Promise<Service[]> => {
    return getAllServices();
  });

const checkDeviceAction = createServerFn({ method: "GET" })
  .validator((d: { deviceId: string }) => d)
  .handler(async ({ data }) => {
    return getActiveVisitByDevice(data.deviceId);
  });

const createVisitAction = createServerFn({ method: "POST" })
  .validator((d: { deviceId: string; serviceCode: string }) => d)
  .handler(async ({ data }) => {
    return createVisit(data.deviceId, data.serviceCode);
  });

export const Route = createFileRoute("/kiosk/")({
  loader: (): Promise<Service[]> => getServicesAction(),
  component: KioskPage,
});

function KioskPage() {
  const services = Route.useLoaderData() as Service[];
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState<string>("");
  type ActiveVisit = NonNullable<Awaited<ReturnType<typeof getActiveVisitByDevice>>>;
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    async function init() {
      const { getDeviceId } = await import("~/lib/device");
      const id = await getDeviceId();
      setDeviceId(id);
      const existing = await checkDeviceAction({ data: { deviceId: id } });
      setActiveVisit(existing);
    }
    init();
  }, []);

  async function handleSelectService(serviceCode: string) {
    if (!deviceId || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await createVisitAction({ data: { deviceId, serviceCode } });
      navigate({ to: "/kiosk/qr/$visitId", params: { visitId: result.id } });
    } catch (err: any) {
      if (err?.message?.includes("DEVICE_LOCKED")) {
        const existing = await checkDeviceAction({ data: { deviceId } });
        setActiveVisit(existing);
      } else {
        setError("Terjadi kesalahan. Silakan coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelActive() {
    setActiveVisit(null);
  }

  return (
    <div className="kiosk-fullscreen flex flex-col bg-gray-50 min-h-dvh">
      {/* Header */}
      <div className="bg-blue-700 text-white px-8 py-5 flex items-center justify-between shadow-lg">
        <div>
          <h1 className="text-2xl font-bold">Klinik Self Service</h1>
          <p className="text-blue-200 text-sm">Pilih layanan yang Anda tuju</p>
        </div>
        <a
          href="/"
          className="text-blue-200 hover:text-white text-sm underline"
          aria-label="Kembali ke halaman utama"
        >
          ← Kembali
        </a>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 max-w-3xl mx-auto w-full gap-6">
        {/* Device lock warning */}
        {activeVisit && (
          <div className="w-full bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center">
            <div className="text-3xl mb-2">⚠️</div>
            <h2 className="text-lg font-bold text-amber-800">
              Anda sudah memiliki antrian aktif
            </h2>
            <p className="text-amber-700 mt-1">
              Layanan:{" "}
              <span className="font-semibold">{activeVisit.service.label}</span>
            </p>
            <p className="text-amber-600 text-sm mt-1">
              Satu perangkat hanya bisa memiliki satu antrian aktif.
            </p>
            <div className="flex gap-3 justify-center mt-4">
              <a
                href={`/visit/${activeVisit.id}`}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 text-sm"
              >
                Lihat Tiket
              </a>
              <button
                onClick={handleCancelActive}
                className="bg-white border border-amber-400 text-amber-700 px-5 py-2 rounded-lg font-medium hover:bg-amber-50 text-sm"
              >
                Tutup Peringatan
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="w-full bg-red-50 border border-red-200 rounded-xl p-4 text-center text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Service Grid */}
        <div className="w-full">
          <h2 className="text-center text-2xl font-semibold text-gray-700 mb-6">
            Pilih Layanan
          </h2>
          <div className="grid grid-cols-2 gap-5">
            {services.map((service) => (
              <ServiceCard
                key={service.code}
                code={service.code}
                label={service.label}
                disabled={loading || !!activeVisit}
                onClick={() => handleSelectService(service.code)}
              />
            ))}
          </div>
        </div>

        {loading && (
          <div className="text-blue-600 text-lg font-medium animate-pulse">
            Memproses...
          </div>
        )}
      </div>
    </div>
  );
}
