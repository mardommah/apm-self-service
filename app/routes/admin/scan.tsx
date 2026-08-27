import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { BarcodeScanner, type ScanResult } from "~/components/admin/BarcodeScanner";
import { markServed, getVisitById } from "~/server/functions/visits";
import { verifyToken } from "~/server/functions/auth";
import { getBarcodeEnabled } from "~/server/functions/settings";
import { formatTime } from "~/lib/utils";

const scanServeAction = createServerFn({ method: "POST" })
  .validator((d: { token: string; visitId: string }) => d)
  .handler(async ({ data }): Promise<ScanResult> => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("UNAUTHORIZED");
    if (!(await getBarcodeEnabled())) throw new Error("BARCODE_DISABLED");

    const visit = await getVisitById(data.visitId);
    if (!visit) {
      return { status: "not_found", message: "Kunjungan tidak ditemukan di database." };
    }

    if (visit.status === "revoked") {
      return {
        status: "revoked",
        visitId: visit.id,
        message: "Kunjungan ini telah dibatalkan sebelumnya.",
      };
    }

    if (visit.status === "served") {
      return {
        status: "already_served",
        visitId: visit.id,
        message: `Pasien ini sudah ditandai sebagai dilayani.`,
        servedAt: visit.servedAt
          ? formatTime(visit.servedAt)
          : "-",
      };
    }

    const result = await markServed(data.visitId, payload.adminId);
    if (!result.success) {
      return {
        status: "error",
        message: `Gagal: ${result.reason}`,
      };
    }

    return {
      status: "success",
      visitId: visit.id,
      message: `Pasien berhasil diterima oleh ${payload.username}.`,
      serviceLabel: visit.service.label,
      servedAt: formatTime(new Date()),
    };
  });

const getScanSettingAction = createServerFn({ method: "GET" })
  .validator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    if (!verifyToken(data.token)) throw new Error("UNAUTHORIZED");
    return getBarcodeEnabled();
  });

export const Route = createFileRoute("/admin/scan")({
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string>("");
  const [adminName, setAdminName] = useState<string>("");
  const [scanCount, setScanCount] = useState(0);
  const [barcodeEnabled, setBarcodeEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    async function init() {
      const { getToken, isLoggedIn, getAdminUsername } = await import("~/lib/auth-client");
      if (!isLoggedIn()) {
        navigate({ to: "/admin/login" });
        return;
      }
      setToken(getToken()!);
      setAdminName(getAdminUsername() ?? "");
      setBarcodeEnabled(await getScanSettingAction({ data: { token: getToken()! } }));
    }
    init();
  }, []);

  async function handleScan(visitId: string): Promise<ScanResult> {
    if (!token) return { status: "error", message: "Tidak terautentikasi" };
    const result = await scanServeAction({ data: { token, visitId } });
    if (result.status === "success") setScanCount((c) => c + 1);
    return result;
  }

  if (barcodeEnabled === false) {
    return (
      <main className="min-h-dvh grid place-items-center bg-gray-900 px-6 text-center text-white">
        <section className="max-w-md rounded-2xl border border-gray-700 bg-gray-800 p-8">
          <h1 className="text-xl font-bold">Fitur barcode nonaktif</h1>
          <p className="mt-2 text-gray-400">Aktifkan melalui Pengaturan Aplikasi.</p>
          <Link to="/admin/dashboard" className="mt-5 inline-block text-blue-400 hover:underline">
            Kembali ke Dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 px-4 py-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Link to="/admin/dashboard" className="text-gray-400 hover:text-white text-sm">
            ← Dashboard
          </Link>
          <div className="w-px h-4 bg-gray-600" />
          <h1 className="font-semibold text-white">Scan Barcode Pasien</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="text-green-400 font-mono">{scanCount}</span>
          <span>scan</span>
          {adminName && <span className="hidden sm:block">· {adminName}</span>}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-start px-4 py-8 gap-6 max-w-md mx-auto w-full">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">Scan QR Tiket Pasien</h2>
          <p className="text-gray-400 text-sm mt-1">
            Arahkan kamera ke QR code pada HP pasien
          </p>
        </div>

        {token && barcodeEnabled ? (
          <BarcodeScanner onScan={handleScan} />
        ) : (
          <div className="text-gray-500 animate-pulse">Menginisialisasi kamera...</div>
        )}

        {/* Tips */}
        <div className="bg-gray-800 rounded-xl p-4 w-full text-sm text-gray-400 space-y-2">
          <p className="font-medium text-gray-300">Tips:</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Pastikan layar HP pasien terang dan tidak silau</li>
            <li>Jarak scan ideal: 15–30 cm</li>
            <li>Kamera akan reset otomatis setelah scan berhasil</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
