import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/start-server-core";
import { useRef, useState } from "react";
import { ServiceCard } from "~/components/kiosk/ServiceCard";
import {
  BpjsCameraScanner,
  type BpjsCheckinQrData,
} from "~/components/kiosk/BpjsCameraScanner";
import { TouchKeyboard } from "~/components/kiosk/TouchKeyboard";
import { printBpjsCheckin } from "~/lib/print";
import { checkInBpjsBooking } from "~/server/functions/bpjs";
import { getFristaBypassEnabled } from "~/server/functions/settings";
import { getAllServices, createVisit } from "~/server/functions/visits";
import type { Service } from "~/server/schema";

// ─── Server functions ─────────────────────────────────────────────────────────
type CreateVisitResult = Awaited<ReturnType<typeof createVisit>>;
type FristaJob = { agentUrl: string; token: string };
type CheckinResult =
  | { ok: true; message: string; fristaJob: FristaJob; validationPassed: boolean }
  | { ok: false; message: string };
type KioskData = {
  services: Service[];
  fristaBypassEnabled: boolean;
  generalPatientUrl: string | null;
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
      const [services, fristaBypassEnabled] = await Promise.all([
        getAllServices(),
        getFristaBypassEnabled(),
      ]);
      let generalPatientUrl: string | null = null;
      try {
        const url = new URL(process.env.MLITE_GENERAL_PATIENT_URL ?? "");
        if (url.protocol === "http:" || url.protocol === "https:") generalPatientUrl = url.toString();
      } catch {}
      return { services, fristaBypassEnabled, generalPatientUrl } satisfies KioskData;
    }
    if (data.action === "checkin") {
      try {
        const result = await checkInBpjsBooking(data.bookingCode, data.cardNumber);
        return {
          ok: true as const,
          message: result.message,
          fristaJob: result.fristaJob,
          validationPassed: result.validationPassed,
        };
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
  const { services, fristaBypassEnabled, generalPatientUrl } = Route.useLoaderData() as KioskData;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [patientTypeOpen, setPatientTypeOpen] = useState(false);
  const [generalPatientOpen, setGeneralPatientOpen] = useState(false);
  const [generalPatientLoaded, setGeneralPatientLoaded] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingNumber, setBookingNumber] = useState("");
  const [bpjsCardNumber, setBpjsCardNumber] = useState("");
  const [activeCheckinInput, setActiveCheckinInput] = useState<"booking" | "card">("card");
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [checkinMessage, setCheckinMessage] = useState("");
  const [fristaJob, setFristaJob] = useState<FristaJob | null>(null);
  const [fristaProcessing, setFristaProcessing] = useState(false);
  const [fristaValidationPassed, setFristaValidationPassed] = useState(true);
  const [checkinQrData, setCheckinQrData] = useState<BpjsCheckinQrData | null>(null);
  const bookingInputRef = useRef<HTMLInputElement>(null);
  const bpjsCardInputRef = useRef<HTMLInputElement>(null);

  function closeBookingModal() {
    setBookingOpen(false);
    setCameraScannerOpen(false);
    setBookingNumber("");
    setBpjsCardNumber("");
    setActiveCheckinInput("card");
    setFristaJob(null);
    setFristaValidationPassed(true);
    setCheckinQrData(null);
    setFristaProcessing(false);
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
    if (serviceCode === "poli_umum") {
      if (!generalPatientUrl) {
        setError("Halaman anjungan pasien umum belum dikonfigurasi.");
        return;
      }
      setError("");
      setGeneralPatientLoaded(false);
      setGeneralPatientOpen(true);
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
    if (
      !checkinQrData ||
      checkinQrData.bookingCode !== booking ||
      checkinQrData.cardNumber !== bpjsCardNumber
    ) {
      setError("Scan QR check-in agar data bukti cetak tersedia dan sesuai.");
      return;
    }
    setLoading(true);
    setError("");
    setCheckinMessage("");
    try {
      let job = fristaJob;
      let validationPassed = fristaValidationPassed;
      if (!job) {
        const result = await checkinAction(booking, bpjsCardNumber);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        job = result.fristaJob;
        validationPassed = result.validationPassed;
        setFristaValidationPassed(result.validationPassed);
        setFristaJob(job);
        setCameraScannerOpen(false);
        setCheckinMessage("Check-in berhasil. Membuka Frista...");
      }

      setFristaProcessing(true);
      const response = await fetch(`${job.agentUrl}/jobs/frista`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: job.token, cardNumber: bpjsCardNumber }),
      }).catch(() => {
        throw new Error("FRISTA_AGENT_FAILED");
      });
      if (!response.ok && !fristaBypassEnabled) {
        throw new Error("FRISTA_AGENT_FAILED");
      }
      if (!checkinQrData) {
        throw new Error("CHECKIN_PRINT_DATA_MISSING");
      }
      printBpjsCheckin(checkinQrData);
      setBookingOpen(false);
      setBookingNumber("");
      setBpjsCardNumber("");
      setActiveCheckinInput("card");
      setCameraScannerOpen(false);
      setFristaJob(null);
      setFristaValidationPassed(true);
      setCheckinQrData(null);
      setCheckinMessage(
        validationPassed && response.ok
          ? "Proses Frista selesai. Bukti check-in telah dikirim ke printer."
          : "Mode dev: validasi atau Frista berstatus gagal. Bukti QR tetap dikirim ke printer.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === "FRISTA_AGENT_FAILED"
          ? "Check-in berhasil, tetapi Frista gagal dibuka. Pastikan secure agent dan JKN Biometrik Bot berjalan, lalu coba lagi."
          : "Layanan check-in BPJS tidak dapat dihubungi.",
      );
    } finally {
      setFristaProcessing(false);
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
        {generalPatientOpen && generalPatientUrl && (
          <section className="fixed inset-0 z-[60] flex flex-col bg-white" aria-label="Anjungan pasien umum">
            <header className="flex items-center justify-between gap-4 bg-blue-700 px-6 py-4 text-white shadow-lg">
              <div>
                <h2 className="text-xl font-bold">Pendaftaran Pasien Umum</h2>
                <p className="text-sm text-blue-100">Selesaikan pendaftaran pada halaman anjungan.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setGeneralPatientOpen(false);
                  setGeneralPatientLoaded(false);
                }}
                className="rounded-xl bg-white px-5 py-3 font-bold text-blue-700 shadow hover:bg-blue-50"
              >
                Kembali ke Home
              </button>
            </header>
            <div className="relative min-h-0 flex-1">
              {!generalPatientLoaded && (
                <div className="absolute inset-0 z-10 grid place-items-center bg-white">
                  <div className="text-center">
                    <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700" />
                    <p className="mt-4 font-semibold text-blue-800">Memuat halaman anjungan...</p>
                  </div>
                </div>
              )}
              <iframe
                src={generalPatientUrl}
                title="Halaman pendaftaran pasien umum"
                onLoad={() => setGeneralPatientLoaded(true)}
                className="h-full w-full border-0"
              />
            </div>
          </section>
        )}
        {fristaProcessing && (
          <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/70 p-6 backdrop-blur-sm">
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="frista-processing-title"
              className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl"
            >
              <div
                aria-hidden="true"
                className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-blue-100 border-t-blue-700"
              />
              <h2 id="frista-processing-title" className="mt-5 text-2xl font-bold text-gray-900">
                Proses Frista Berjalan
              </h2>
              <p className="mt-3 text-gray-600">
                Selesaikan verifikasi biometrik pada aplikasi Frista. Jangan tutup atau muat ulang halaman ini.
              </p>
              <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-800">
                Bukti check-in dicetak otomatis setelah proses selesai.
              </p>
            </section>
          </div>
        )}
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
              <p className="mt-2 text-gray-500">
                {fristaBypassEnabled
                  ? "Mode uji Frista aktif. Validasi FKTL tetap dijalankan; kegagalan tidak menghentikan Frista dan pencetakan."
                  : "Scan satu QR check-in Mobile JKN untuk mengisi nomor kartu dan kode booking. Input manual tetap tersedia."}
              </p>
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
                      onCheckinScan={(data) => {
                        const { bookingCode, cardNumber } = data;
                        setBookingNumber(bookingCode);
                        setBpjsCardNumber(cardNumber);
                        setCheckinQrData(data);
                        setCameraScannerOpen(false);
                        setActiveCheckinInput("booking");
                        bookingInputRef.current?.focus();
                      }}
                    />
                  )}
                  {!cameraScannerOpen && (
                    <TouchKeyboard
                      value={activeCheckinInput === "booking" ? bookingNumber : bpjsCardNumber}
                      onChange={(value) => {
                        setCheckinQrData(null);
                        if (activeCheckinInput === "booking") setBookingNumber(value);
                        else setBpjsCardNumber(value);
                      }}
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
                  onChange={(event) => {
                    setCheckinQrData(null);
                    setBpjsCardNumber(event.target.value.replace(/\D/g, ""));
                  }}
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
                  onChange={(event) => {
                    setCheckinQrData(null);
                    setBookingNumber(event.target.value);
                  }}
                  onFocus={() => setActiveCheckinInput("booking")}
                  autoComplete="off"
                  inputMode="none"
                  maxLength={100}
                  required
                  className="rounded-xl border-2 border-gray-200 p-4 text-xl uppercase"
                  placeholder="Contoh: ABC12345"
                />
              </label>
              {fristaBypassEnabled && (
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                  Pengujian aktif: kegagalan validasi FKTL tidak menghentikan Frista. Bukti QR tetap dicetak setelah agent merespons.
                </div>
              )}
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
