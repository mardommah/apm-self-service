import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { StatsCards } from "~/components/admin/StatsCards";
import { VisitsTable } from "~/components/admin/VisitsTable";
import { Button } from "~/components/ui/button";
import {
  listVisits,
  getDailyStats,
  markServed,
  revokeVisit,
  deleteVisit,
  countVisits,
  getAdminServices,
  createPoliService,
  updatePoliService,
} from "~/server/functions/visits";
import { verifyToken } from "~/server/functions/auth";
import { getBarcodeEnabled, setBarcodeEnabled } from "~/server/functions/settings";
import type { VisitStatus } from "~/server/schema";

// ─── Server functions ─────────────────────────────────────────────────────────
const getDashboardDataAction = createServerFn({ method: "GET" })
  .validator((d: { token: string; status?: string; serviceCode?: string; page?: number }) => d)
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("UNAUTHORIZED");

    const pageSize = 10;
    const page = Math.max(1, Math.floor(data.page ?? 1));
    const filters = {
      status: (data.status as VisitStatus) || undefined,
      serviceCode: data.serviceCode || undefined,
    };
    const [visits, totalVisits, stats, services, barcodeEnabled] = await Promise.all([
      listVisits({
        ...filters,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      countVisits(filters),
      getDailyStats(),
      getAdminServices(),
      getBarcodeEnabled(),
    ]);
    return {
      visits,
      totalVisits,
      page,
      pageSize,
      stats,
      services,
      barcodeEnabled,
      admin: { username: payload.username, role: payload.role },
    };
  });

const createPoliAction = createServerFn({ method: "POST" })
  .validator((d: { token: string; code: string; label: string }) => d)
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload || payload.role !== "admin") throw new Error("UNAUTHORIZED");
    await createPoliService(data.code, data.label);
    return { ok: true };
  });

const updatePoliAction = createServerFn({ method: "POST" })
  .validator((d: { token: string; id: number; label: string; isActive: boolean }) => d)
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload || payload.role !== "admin") throw new Error("UNAUTHORIZED");
    await updatePoliService(data.id, data.label, data.isActive);
    return { ok: true };
  });

const updateBarcodeSettingAction = createServerFn({ method: "POST" })
  .validator((d: { token: string; enabled: boolean }) => d)
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload || payload.role !== "admin") throw new Error("UNAUTHORIZED");
    await setBarcodeEnabled(data.enabled);
    return { ok: true };
  });

const serveAction = createServerFn({ method: "POST" })
  .validator((d: { token: string; visitId: string }) => d)
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("UNAUTHORIZED");
    return markServed(data.visitId, payload.adminId);
  });

const revokeAction = createServerFn({ method: "POST" })
  .validator((d: { token: string; visitId: string }) => d)
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("UNAUTHORIZED");
    await revokeVisit(data.visitId);
    return { ok: true };
  });

const deleteAction = createServerFn({ method: "POST" })
  .validator((d: { token: string; visitId: string }) => d)
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("UNAUTHORIZED");
    await deleteVisit(data.visitId);
    return { ok: true };
  });

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string>("");
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardDataAction>> | null>(null);
  const [loadingVisit, setLoadingVisit] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [page, setPage] = useState(1);
  const [poliCode, setPoliCode] = useState("poli_");
  const [poliLabel, setPoliLabel] = useState("");
  const [poliError, setPoliError] = useState("");
  const [savingPoli, setSavingPoli] = useState(false);
  const [poliModalOpen, setPoliModalOpen] = useState(false);
  const [savingBarcode, setSavingBarcode] = useState(false);

  useEffect(() => {
    async function init() {
      const { getToken, isLoggedIn } = await import("~/lib/auth-client");
      if (!isLoggedIn()) {
        navigate({ to: "/admin/login" });
        return;
      }
      const t = getToken()!;
      setToken(t);
      fetchData(t, "", "", 1);
    }
    init();
  }, []);

  useEffect(() => {
    if (!token || !autoRefresh) return;
    const interval = setInterval(
      () => fetchData(token, statusFilter, serviceFilter, page),
      30_000,
    );
    return () => clearInterval(interval);
  }, [token, autoRefresh, statusFilter, serviceFilter, page]);

  async function fetchData(t: string, status?: string, service?: string, targetPage = page) {
    try {
      const result = await getDashboardDataAction({
        data: { token: t, status, serviceCode: service, page: targetPage },
      });
      setData(result);
      setPage(result.page);
    } catch {
      navigate({ to: "/admin/login" });
    }
  }

  async function handleApplyFilter() {
    if (token) fetchData(token, statusFilter, serviceFilter, 1);
  }

  async function handleCreatePoli(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSavingPoli(true);
    setPoliError("");
    try {
      await createPoliAction({ data: { token, code: poliCode, label: poliLabel } });
      setPoliCode("poli_");
      setPoliLabel("");
      await fetchData(token, statusFilter, serviceFilter, page);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setPoliError(
        message.includes("Duplicate")
          ? "Kode poli sudah digunakan."
          : "Kode harus diawali poli_ dan hanya berisi huruf kecil, angka, atau underscore.",
      );
    } finally {
      setSavingPoli(false);
    }
  }

  async function handleUpdatePoli(id: number, label: string, isActive: boolean) {
    if (!token) return;
    setSavingPoli(true);
    setPoliError("");
    try {
      await updatePoliAction({ data: { token, id, label, isActive } });
      await fetchData(token, statusFilter, serviceFilter, page);
    } catch {
      setPoliError("Poli gagal diperbarui.");
    } finally {
      setSavingPoli(false);
    }
  }

  async function handleBarcodeSetting(enabled: boolean) {
    if (!token) return;
    setSavingBarcode(true);
    try {
      await updateBarcodeSettingAction({ data: { token, enabled } });
      await fetchData(token, statusFilter, serviceFilter, page);
    } finally {
      setSavingBarcode(false);
    }
  }

  async function handleServe(visitId: string) {
    if (!token) return;
    setLoadingVisit(visitId);
    try {
      await serveAction({ data: { token, visitId } });
      fetchData(token, statusFilter, serviceFilter);
    } finally {
      setLoadingVisit(null);
    }
  }

  async function handleRevoke(visitId: string) {
    if (!token) return;
    setLoadingVisit(visitId);
    try {
      await revokeAction({ data: { token, visitId } });
      fetchData(token, statusFilter, serviceFilter);
    } finally {
      setLoadingVisit(null);
    }
  }

  async function handleDelete(visitId: string) {
    if (!token) return;
    setLoadingVisit(visitId);
    try {
      await deleteAction({ data: { token, visitId } });
      fetchData(token, statusFilter, serviceFilter);
    } finally {
      setLoadingVisit(null);
    }
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
      {poliModalOpen && data.admin.role === "admin" && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !savingPoli && setPoliModalOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="poli-settings-title"
            onClick={(event) => event.stopPropagation()}
            className="relative max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <button
              type="button"
              aria-label="Tutup pengaturan poli"
              disabled={savingPoli}
              onClick={() => setPoliModalOpen(false)}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-gray-100 text-xl text-gray-600 hover:bg-gray-200 disabled:opacity-50"
            >
              ×
            </button>

            <h2 id="poli-settings-title" className="pr-12 text-xl font-semibold text-gray-800">
              Pengaturan Aplikasi
            </h2>

            <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <p className="font-medium text-gray-800">Fitur barcode / QR</p>
                <p className="text-sm text-gray-500">
                  Jika nonaktif, kiosk hanya menampilkan dan mencetak karcis antrean.
                </p>
              </div>
              <Button
                type="button"
                variant={data.barcodeEnabled ? "success" : "outline"}
                disabled={savingBarcode}
                onClick={() => handleBarcodeSetting(!data.barcodeEnabled)}
              >
                {data.barcodeEnabled ? "Aktif" : "Nonaktif"}
              </Button>
            </div>

            <h3 className="mt-7 font-semibold text-gray-800">Pengaturan Poli</h3>
            <p className="mt-1 text-sm text-gray-500">Poli aktif tampil pada pilihan layanan.</p>

            <form onSubmit={handleCreatePoli} className="mt-5 grid gap-3 md:grid-cols-[1fr_1.5fr_auto]">
              <input
                value={poliCode}
                onChange={(event) => setPoliCode(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="poli_gigi"
                aria-label="Kode poli"
                required
                className="h-10 rounded-md border border-gray-300 px-3 text-sm"
              />
              <input
                value={poliLabel}
                onChange={(event) => setPoliLabel(event.target.value)}
                placeholder="Nama poli"
                aria-label="Nama poli"
                maxLength={100}
                required
                className="h-10 rounded-md border border-gray-300 px-3 text-sm"
              />
              <Button type="submit" disabled={savingPoli}>Tambah Poli</Button>
            </form>

            {poliError && <p className="mt-3 text-sm text-red-600">{poliError}</p>}

            <div className="mt-5 divide-y rounded-lg border">
              {data.services.filter((service) => service.code.startsWith("poli_")).map((service) => (
                <div key={service.id} className="grid items-center gap-3 p-3 md:grid-cols-[1fr_1.5fr_auto]">
                  <code className="text-sm text-gray-600">{service.code}</code>
                  <input
                    defaultValue={service.label}
                    maxLength={100}
                    aria-label={`Nama ${service.code}`}
                    className="h-9 rounded-md border border-gray-300 px-3 text-sm"
                    onBlur={(event) => {
                      if (event.target.value.trim() !== service.label) {
                        handleUpdatePoli(service.id, event.target.value, service.isActive);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={service.isActive ? "outline" : "success"}
                    disabled={savingPoli}
                    onClick={() => handleUpdatePoli(service.id, service.label, !service.isActive)}
                  >
                    {service.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏥</span>
          <div>
            <h1 className="font-bold text-gray-900">Klinik Syamsinar Maros Self Service</h1>
            <p className="text-xs text-gray-400">Admin Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {data.admin.role === "admin" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Buka pengaturan poli"
              title="Pengaturan Poli"
              onClick={() => setPoliModalOpen(true)}
              className="text-xl"
            >
              ⚙️
            </Button>
          )}
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800">Statistik Hari Ini</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                Auto refresh
              </label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchData(token, statusFilter, serviceFilter)}
              >
                🔄 Refresh
              </Button>
            </div>
          </div>
          <StatsCards stats={data.stats as any} />
        </section>

        {/* Filters */}
        <section className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-gray-300 text-sm bg-white"
            >
              <option value="">Semua Status</option>
              <option value="waiting">Menunggu</option>
              <option value="served">Dilayani</option>
              <option value="revoked">Dibatalkan</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">Layanan</label>
            <select
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-gray-300 text-sm bg-white"
            >
              <option value="">Semua Layanan</option>
              {data.services.map((service) => (
                <option key={service.code} value={service.code}>{service.label}</option>
              ))}
            </select>
          </div>
          <Button onClick={handleApplyFilter} size="sm">
            Terapkan Filter
          </Button>
          {(statusFilter || serviceFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("");
                setServiceFilter("");
                fetchData(token, "", "", 1);
              }}
            >
              Reset
            </Button>
          )}
        </section>

        {/* Table */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Daftar Kunjungan
            <span className="ml-2 text-sm font-normal text-gray-400">
              ({data.totalVisits} record)
            </span>
          </h2>
          <VisitsTable
            visits={data.visits as any}
            onServe={handleServe}
            onRevoke={handleRevoke}
            onDelete={handleDelete}
            loading={loadingVisit}
          />
          <nav className="mt-4 flex items-center justify-between" aria-label="Pagination kunjungan">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => fetchData(token, statusFilter, serviceFilter, page - 1)}
              >
                ← Sebelumnya
              </Button>
              <span className="text-sm text-gray-600">
                Halaman {page} dari {Math.ceil(data.totalVisits / data.pageSize)}
              </span>
              <Button
                variant="outline"
                disabled={page >= Math.ceil(data.totalVisits / data.pageSize)}
                onClick={() => fetchData(token, statusFilter, serviceFilter, page + 1)}
              >
                Berikutnya →
              </Button>
          </nav>
        </section>
      </main>
    </div>
  );
}
