import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { LoketCaller } from "~/components/admin/LoketCaller";
import { AdminNavLinks } from "~/components/admin/AdminNavLinks";
import { Button } from "~/components/ui/button";
import { getDashboardDataAction } from "~/server/actions/dashboard-data";
import { getSavedLoket, LOKET_COUNT, saveLoket } from "~/lib/admin-loket";

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string>("");
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardDataAction>> | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loket, setLoket] = useState(1);

  useEffect(() => {
    async function init() {
      const { getToken, isLoggedIn } = await import("~/lib/auth-client");
      if (!isLoggedIn()) {
        navigate({ to: "/admin/login" });
        return;
      }
      const t = getToken()!;
      setToken(t);
      fetchData(t);
    }
    init();
  }, []);

  useEffect(() => {
    setLoket(getSavedLoket());
  }, []);

  useEffect(() => {
    if (!token || !autoRefresh) return;
    const interval = setInterval(
      () => fetchData(token),
      30_000,
    );
    return () => clearInterval(interval);
  }, [token, autoRefresh]);

  // Settings, services and admin info; the visits list lives on /admin/kunjungan.
  async function fetchData(t: string) {
    try {
      setData(await getDashboardDataAction({ data: { token: t } }));
    } catch (error) {
      const { clearToken, isUnauthorized } = await import("~/lib/auth-client");
      if (!isUnauthorized(error)) return;
      clearToken();
      navigate({ to: "/admin/login" });
    }
  }


  function handleLoketChange(value: number) {
    setLoket(value);
    saveLoket(value);
  }


  async function handleLogout() {
    const { clearToken } = await import("~/lib/auth-client");
    clearToken();
    navigate({ to: "/admin/login" });
  }

  if (!data) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-lg animate-pulse">Memuat data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏥</span>
          <div>
            <h1 className="font-bold text-gray-900">Klinik Syamsinar Maros Self Service</h1>
            <p className="text-xs text-gray-400">Admin Dashboard</p>
          </div>
          <AdminNavLinks isAdmin={data.admin.role === "admin"} />
        </div>
        <div className="flex items-center gap-3">
          {data.barcodeEnabled && (
            <Link
              to="/admin/scan"
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
            >
              📷 Scan Barcode
            </Link>
          )}
          <span className="text-sm text-gray-600 hidden sm:block">
            {data.admin.username}
            <span className="ml-1 text-xs text-gray-400">({data.admin.role})</span>
          </span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Keluar
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* 1. Work bar: which loket this petugas is, and freshness of the data */}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
          <label className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Saya melayani di</span>
            <select
              value={loket}
              onChange={(e) => handleLoketChange(Number(e.target.value))}
              aria-label="Loket saya"
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-900"
            >
              {Array.from({ length: LOKET_COUNT }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>Loket {n}</option>
              ))}
            </select>
            <span className="hidden text-sm text-gray-500 md:inline">Panggilan tampil di layar TV sebagai Loket {loket}.</span>
          </label>
          <div className="flex items-center gap-3">
            <a href="/display" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-700 underline">
              Buka layar TV ↗
            </a>
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-600">
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded" />
              Perbarui otomatis
            </label>
            <Button size="sm" variant="outline" onClick={() => fetchData(token)}>
              🔄 Perbarui
            </Button>
          </div>
        </section>

        {/* 2. Primary task: call patients */}
        {token && <LoketCaller token={token} loket={loket} onChange={() => fetchData(token)} />}

      </main>
    </div>
  );
}
