import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/start-server-core";
import { useRef, useState } from "react";
import { ServiceCard } from "~/components/kiosk/ServiceCard";
import { getAllServices, createVisit } from "~/server/functions/visits";
import type { Service } from "~/server/schema";

// ─── Server functions ─────────────────────────────────────────────────────────
type CreateVisitResult = Awaited<ReturnType<typeof createVisit>>;
type KioskData = {
  services: Service[];
  mliteBpjsUrl: string | null;
};
type KioskActionInput =
  | { action: "services" }
  | {
      action: "create";
      serviceCode: string;
      destinationServiceCode?: string;
      patientStatus?: "baru" | "lama";
    };

const kioskAction = createServerFn({ method: "POST" })
  .validator((data: KioskActionInput) => data)
  .handler(async ({ data }) => {
    if (data.action === "services") {
      const baseUrl = process.env.MLITE_BASE_URL?.replace(/\/$/, "");
      let mliteBpjsUrl: string | null = null;
      if (baseUrl) {
        try {
          const url = new URL(`${baseUrl}/anjungan/checkin`);
          if (url.protocol === "http:" || url.protocol === "https:") {
            mliteBpjsUrl = url.toString();
          }
        } catch {}
      }
      return { services: await getAllServices(), mliteBpjsUrl } satisfies KioskData;
    }
    const registration =
      data.destinationServiceCode && data.patientStatus
        ? {
            destinationServiceCode: data.destinationServiceCode,
            patientStatus: data.patientStatus,
          }
        : undefined;
    const result = await createVisit(data.serviceCode, registration);
    if (registration) {
      setCookie("bpjs_kiosk_visit_id", result.id, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 30,
      });
    }
    return result;
  });

const getServicesAction = () =>
  kioskAction({ data: { action: "services" } }) as Promise<KioskData>;
const createVisitAction = (
  serviceCode: string,
  registration?: { destinationServiceCode: string; patientStatus: "baru" | "lama" },
) =>
  kioskAction({
    data: { action: "create", serviceCode, ...registration },
  }) as Promise<CreateVisitResult>;

export const Route = createFileRoute("/kiosk/")({
  loader: (): Promise<KioskData> => getServicesAction(),
  component: KioskPage,
});

function KioskPage() {
  const { services, mliteBpjsUrl } = Route.useLoaderData() as KioskData;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingNumber, setBookingNumber] = useState("");
  const [mliteCheckinUrl, setMliteCheckinUrl] = useState<string | null>(null);
  const [showMliteReturnPrompt, setShowMliteReturnPrompt] = useState(false);
  const mliteLoadCount = useRef(0);

  async function handleSelectService(serviceCode: string) {
    if (loading) return;
    if (serviceCode === "registrasi") {
      if (!mliteBpjsUrl) {
        setError("Akses BPJS mLITE belum dikonfigurasi.");
        return;
      }
      setError("");
      setBookingOpen(true);
      return;
    }
    await submitVisit(serviceCode);
  }

  function handleBpjsCheckin(event: React.FormEvent) {
    event.preventDefault();
    const booking = bookingNumber.trim();
    if (!booking || !mliteBpjsUrl) {
      setError("Masukkan nomor booking.");
      return;
    }
    const checkinUrl = `${mliteBpjsUrl.replace(/\/$/, "")}/${encodeURIComponent(booking)}`;
    mliteLoadCount.current = 0;
    setShowMliteReturnPrompt(false);
    setMliteCheckinUrl(checkinUrl);
    setBookingOpen(false);
    setBookingNumber("");
  }

  async function submitVisit(
    serviceCode: string,
    registration?: { destinationServiceCode: string; patientStatus: "baru" | "lama" },
  ) {
    setLoading(true);
    setError("");
    try {
      const result = await createVisitAction(serviceCode, registration);
      navigate({ to: "/kiosk/qr/$visitId", params: { visitId: result.id } });
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="kiosk-fullscreen flex flex-col bg-gray-50 min-h-dvh">
      {/* Header */}
      <div className="bg-blue-700 text-white px-8 py-5 shadow-lg flex items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold">Klinik Syamsinar Maros Self Service</h1>
          <p className="text-blue-200 text-sm">Pilih layanan yang Anda tuju</p>
        </div>
        <img
          src="/logo-klinik-s.png"
          alt="Klinik Syamsinar"
          className="h-16 w-auto max-w-[40%] rounded-xl bg-white object-contain"
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 max-w-5xl mx-auto w-full gap-6">
        {mliteCheckinUrl && (
          <section className="fixed inset-0 z-[60] flex flex-col bg-white" aria-label="Check-in BPJS mLITE">
            {showMliteReturnPrompt && (
              <div className="absolute inset-0 z-10 grid place-items-center bg-slate-950/60 p-6 backdrop-blur-sm">
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="mlite-return-title"
                  className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl"
                >
                  <h2 id="mlite-return-title" className="text-2xl font-bold text-gray-900">
                    Proses check-in selesai?
                  </h2>
                  <p className="mt-3 text-gray-600">
                    Kembali ke home, atau lanjutkan halaman mLITE jika masih perlu verifikasi Frista.
                  </p>
                  <div className="mt-6 grid gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMliteReturnPrompt(false);
                        setMliteCheckinUrl(null);
                      }}
                      className="rounded-xl bg-blue-700 px-6 py-4 text-lg font-bold text-white"
                    >
                      Kembali ke Home
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMliteReturnPrompt(false)}
                      className="rounded-xl border-2 border-gray-200 px-6 py-3 font-semibold text-gray-700"
                    >
                      Lanjutkan Proses mLITE
                    </button>
                  </div>
                </div>
              </div>
            )}
            <header className="flex items-center justify-between gap-4 bg-blue-700 px-5 py-4 text-white shadow-lg">
              <div>
                <h2 className="text-xl font-bold">Check-in BPJS</h2>
                <p className="text-sm text-blue-100">Selesaikan proses pada halaman mLITE.</p>
              </div>
              <button
                type="button"
                onClick={() => setMliteCheckinUrl(null)}
                className="rounded-xl bg-white px-5 py-3 font-bold text-blue-700"
              >
                Kembali ke Home
              </button>
            </header>
            <iframe
              src={mliteCheckinUrl}
              title="Halaman check-in BPJS mLITE"
              className="min-h-0 flex-1 w-full border-0"
              onLoad={() => {
                mliteLoadCount.current += 1;
                if (mliteLoadCount.current > 1) setShowMliteReturnPrompt(true);
              }}
            />
          </section>
        )}

        {bookingOpen && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-6 backdrop-blur-sm"
            role="presentation"
            onClick={() => setBookingOpen(false)}
          >
            <form
              onSubmit={handleBpjsCheckin}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl"
            >
              <button
                type="button"
                aria-label="Tutup input nomor booking"
                onClick={() => setBookingOpen(false)}
                className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-gray-100 text-2xl text-gray-600"
              >
                ×
              </button>
              <h2 className="pr-14 text-2xl font-bold text-gray-900">Check-in BPJS</h2>
              <p className="mt-2 text-gray-500">Masukkan nomor booking Mobile JKN.</p>
              <label className="mt-6 grid gap-2 font-semibold text-gray-700">
                Nomor Booking
                <input
                  autoFocus
                  value={bookingNumber}
                  onChange={(event) => setBookingNumber(event.target.value)}
                  autoComplete="off"
                  maxLength={100}
                  required
                  className="rounded-xl border-2 border-gray-200 p-4 text-xl uppercase"
                  placeholder="Contoh: ABC12345"
                />
              </label>
              <button
                type="submit"
                className="mt-6 w-full rounded-xl bg-blue-700 px-6 py-4 text-lg font-bold text-white"
              >
                Check-in
              </button>
            </form>
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
          <div className="grid grid-cols-2 gap-7">
            {services.map((service) => (
              <ServiceCard
                key={service.code}
                code={service.code}
                label={service.label}
                disabled={loading}
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
