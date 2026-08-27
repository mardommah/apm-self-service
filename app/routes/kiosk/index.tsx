import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/start-server-core";
import { useRef, useState } from "react";
import { ServiceCard } from "~/components/kiosk/ServiceCard";
import { BpjsCameraScanner } from "~/components/kiosk/BpjsCameraScanner";
import { TouchKeyboard } from "~/components/kiosk/TouchKeyboard";
import { checkInBpjsBooking } from "~/server/functions/bpjs";
import { getAllServices, createVisit } from "~/server/functions/visits";
import type { Service } from "~/server/schema";

// ─── Server functions ─────────────────────────────────────────────────────────
type CreateVisitResult = Awaited<ReturnType<typeof createVisit>>;
type FristaJob = { agentUrl: string; token: string };
type CheckinResult =
  | { ok: true; message: string; fristaJob: FristaJob }
  | { ok: false; message: string };
type KioskData = {
  services: Service[];
};
type KioskActionInput =
  | { action: "services" }
  | { action: "checkin"; bookingCode: string; cardNumber: string }
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
      return { services: await getAllServices() } satisfies KioskData;
    }
    if (data.action === "checkin") {
      try {
        const result = await checkInBpjsBooking(data.bookingCode, data.cardNumber);
        return { ok: true as const, message: result.message, fristaJob: result.fristaJob };
      } catch (error) {
        const code = error instanceof Error ? error.message : "BPJS_FKTL_REQUEST_FAILED";
        const knownMessages: Record<string, string> = {
          BPJS_FKTL_NOT_CONFIGURED: "Kredensial API BPJS belum dikonfigurasi.",
          BPJS_FKTL_UNAVAILABLE: "Layanan check-in BPJS tidak dapat dihubungi.",
          BPJS_FKTL_INVALID_RESPONSE: "Respons layanan check-in BPJS tidak valid.",
          BPJS_FKTL_TOKEN_MISSING: "Token layanan check-in BPJS tidak tersedia.",
          BOOKING_CODE_INVALID: "Nomor booking tidak valid.",
          BPJS_CARD_INVALID: "Nomor kartu BPJS harus tepat 13 digit.",
          FRISTA_AGENT_NOT_CONFIGURED: "Agent Frista belum dikonfigurasi pada kiosk.",
        };
        return {
          ok: false as const,
          message: knownMessages[code] ?? code,
        };
      }
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
const checkinAction = (bookingCode: string, cardNumber: string) =>
  kioskAction({ data: { action: "checkin", bookingCode, cardNumber } }) as Promise<CheckinResult>;

export const Route = createFileRoute("/kiosk/")({
  loader: (): Promise<KioskData> => getServicesAction(),
  component: KioskPage,
});

function KioskPage() {
  const { services } = Route.useLoaderData() as KioskData;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [patientTypeOpen, setPatientTypeOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingNumber, setBookingNumber] = useState("");
  const [bpjsCardNumber, setBpjsCardNumber] = useState("");
  const [activeCheckinInput, setActiveCheckinInput] = useState<"booking" | "card">("card");
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState("");
  const [fristaJob, setFristaJob] = useState<FristaJob | null>(null);
  const bookingInputRef = useRef<HTMLInputElement>(null);
  const bpjsCardInputRef = useRef<HTMLInputElement>(null);

  function closeBookingModal() {
    setBookingOpen(false);
    setCameraScannerOpen(false);
    setFristaJob(null);
    setError("");
  }

  async function handleSelectService(serviceCode: string) {
    if (loading) return;
    if (serviceCode === "registrasi") {
      setError("");
      setCheckinMessage("");
      setPatientTypeOpen(true);
      return;
    }
    await submitVisit(serviceCode);
  }

  async function handleBpjsCheckin(event: React.FormEvent) {
    event.preventDefault();
    const booking = bookingNumber.trim();
    if (!/^\d{13}$/.test(bpjsCardNumber)) {
      setError("Nomor kartu BPJS harus tepat 13 digit.");
      setActiveCheckinInput("card");
      bpjsCardInputRef.current?.focus();
      return;
    }
    if (!booking) {
      setError("Masukkan nomor booking.");
      setActiveCheckinInput("booking");
      bookingInputRef.current?.focus();
      return;
    }
    setLoading(true);
    setError("");
    setCheckinMessage("");
    try {
      let job = fristaJob;
      if (!job) {
        const result = await checkinAction(booking, bpjsCardNumber);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        job = result.fristaJob;
        setFristaJob(job);
        setCameraScannerOpen(false);
        setCheckinMessage("Check-in berhasil. Membuka Frista...");
      }

      const response = await fetch(`${job.agentUrl}/jobs/frista`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: job.token, cardNumber: bpjsCardNumber }),
      }).catch(() => {
        throw new Error("FRISTA_AGENT_FAILED");
      });
      if (!response.ok) {
        throw new Error("FRISTA_AGENT_FAILED");
      }
      setBookingOpen(false);
      setBookingNumber("");
      setBpjsCardNumber("");
      setFristaJob(null);
      setCheckinMessage("Check-in berhasil. Frista telah dibuka; selesaikan verifikasi wajah pada kamera kiosk.");
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "FRISTA_AGENT_FAILED"
          ? "Check-in berhasil, tetapi Frista gagal dibuka. Pastikan secure agent dan JKN Biometrik Bot berjalan, lalu coba lagi."
          : "Layanan check-in BPJS tidak dapat dihubungi.",
      );
    } finally {
      setLoading(false);
    }
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
        {patientTypeOpen && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-6 backdrop-blur-sm"
            role="presentation"
            onClick={() => setPatientTypeOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="patient-type-title"
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl"
            >
              <button
                type="button"
                aria-label="Tutup pilihan jenis pasien"
                onClick={() => setPatientTypeOpen(false)}
                className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-gray-100 text-2xl text-gray-600"
              >
                ×
              </button>
              <h2 id="patient-type-title" className="pr-14 text-2xl font-bold text-gray-900">
                Pilih Jenis Pasien BPJS
              </h2>
              <p className="mt-2 text-gray-500">Apakah pasien sudah pernah terdaftar di klinik?</p>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setPatientTypeOpen(false);
                    void submitVisit("registrasi");
                  }}
                  className="rounded-2xl border-2 border-green-200 bg-green-50 px-6 py-6 text-lg font-bold text-green-800 hover:border-green-500"
                >
                  Pasien Baru
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setPatientTypeOpen(false);
                    setActiveCheckinInput("card");
                    setCameraScannerOpen(true);
                    setBookingOpen(true);
                  }}
                  className="rounded-2xl border-2 border-blue-200 bg-blue-50 px-6 py-6 text-lg font-bold text-blue-800 hover:border-blue-500"
                >
                  Pasien Lama
                </button>
              </div>
            </div>
          </div>
        )}

        {bookingOpen && (
          <div
            className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-6 backdrop-blur-sm"
            role="presentation"
            onClick={closeBookingModal}
          >
            <form
              onSubmit={handleBpjsCheckin}
              onClick={(event) => event.stopPropagation()}
              className="relative max-h-[calc(100dvh-2rem)] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
            >
              <button
                type="button"
                aria-label="Tutup input nomor booking"
                onClick={closeBookingModal}
                className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full bg-gray-100 text-2xl text-gray-600"
              >
                ×
              </button>
              <h2 className="pr-14 text-2xl font-bold text-gray-900">Check-in BPJS</h2>
              <p className="mt-2 text-gray-500">Langkah 1 scan kartu BPJS. Langkah 2 scan QR kode booking. Input manual tetap tersedia.</p>
              <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
                <section aria-label="Kamera pemindai QR">
                  <button
                    type="button"
                    onClick={() => setCameraScannerOpen((open) => !open)}
                    className="mb-4 rounded-xl border-2 border-blue-200 px-4 py-3 font-bold text-blue-700"
                  >
                    {cameraScannerOpen ? "Gunakan Input Manual" : "Scan dengan Kamera"}
                  </button>
                  {cameraScannerOpen && (
                    <BpjsCameraScanner
                      step={bpjsCardNumber ? "booking" : "card"}
                      onBookingScan={(bookingCode) => {
                        setBookingNumber(bookingCode);
                        setCameraScannerOpen(false);
                      }}
                      onCardScan={(cardNumber) => {
                        setBpjsCardNumber(cardNumber);
                        setActiveCheckinInput("booking");
                        bookingInputRef.current?.focus();
                      }}
                    />
                  )}
                  {!cameraScannerOpen && (
                    <TouchKeyboard
                      value={activeCheckinInput === "booking" ? bookingNumber : bpjsCardNumber}
                      onChange={activeCheckinInput === "booking" ? setBookingNumber : setBpjsCardNumber}
                      maxLength={activeCheckinInput === "booking" ? 100 : 13}
                      mode={activeCheckinInput === "booking" ? "alphanumeric" : "numeric"}
                      disabled={loading}
                    />
                  )}
                </section>
                <section aria-label="Form check-in BPJS">
              <label className="grid gap-2 font-semibold text-gray-700">
                1. Nomor Kartu BPJS
                <input
                  autoFocus
                  ref={bpjsCardInputRef}
                  value={bpjsCardNumber}
                  onChange={(event) => setBpjsCardNumber(event.target.value.replace(/\D/g, ""))}
                  onFocus={() => setActiveCheckinInput("card")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && /^\d{13}$/.test(bpjsCardNumber)) {
                      event.preventDefault();
                      setError("");
                      setActiveCheckinInput("booking");
                      bookingInputRef.current?.focus();
                    }
                  }}
                  autoComplete="off"
                  inputMode="none"
                  maxLength={13}
                  required
                  className="rounded-xl border-2 border-gray-200 p-4 text-xl"
                  placeholder="13 digit nomor kartu BPJS"
                />
              </label>
              <label className="mt-4 grid gap-2 font-semibold text-gray-700">
                2. Kode Booking
                <input
                  ref={bookingInputRef}
                  value={bookingNumber}
                  onChange={(event) => setBookingNumber(event.target.value)}
                  onFocus={() => setActiveCheckinInput("booking")}
                  autoComplete="off"
                  inputMode="none"
                  maxLength={100}
                  required
                  className="rounded-xl border-2 border-gray-200 p-4 text-xl uppercase"
                  placeholder="Contoh: ABC12345"
                />
              </label>
              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700"
                >
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full rounded-xl bg-blue-700 px-6 py-4 text-lg font-bold text-white"
              >
                {loading ? "Memproses..." : fristaJob ? "Coba Buka Frista" : "Check-in dan Buka Frista"}
              </button>
                </section>
              </div>
            </form>
          </div>
        )}

        {/* Error */}
        {error && !bookingOpen && !patientTypeOpen && (
          <div className="w-full bg-red-50 border border-red-200 rounded-xl p-4 text-center text-red-700 text-sm">
            {error}
          </div>
        )}

        {checkinMessage && (
          <div className="w-full rounded-xl border border-green-200 bg-green-50 p-4 text-center text-green-700">
            {checkinMessage}
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
