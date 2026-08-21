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
} from "~/server/functions/visits";
import { verifyToken } from "~/server/functions/auth";
import type { VisitStatus } from "~/server/schema";

// ─── Server functions ─────────────────────────────────────────────────────────
const getDashboardDataAction = createServerFn({ method: "GET" })
  .validator((d: { token: string; status?: string; serviceCode?: string }) => d)
  .handler(async ({ data }) => {
    const payload = verifyToken(data.token);
    if (!payload) throw new Error("UNAUTHORIZED");

    const [visits, stats] = await Promise.all([
      listVisits({
        status: (data.status as VisitStatus) || undefined,
        serviceCode: data.serviceCode || undefined,
        limit: 200,
      }),
      getDailyStats(),
    ]);
    return { visits, stats, admin: { username: payload.username, role: payload.role } };
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
    if (!token || !autoRefresh) return;
    const interval = setInterval(() => fetchData(token), 30_000);
    return () => clearInterval(interval);
  }, [token, autoRefresh]);

  async function fetchData(t: string, status?: string, service?: string) {
    try {
      const result = await getDashboardDataAction({
        data: { token: t, status, serviceCode: service },
      });
      setData(result);
    } catch {
      navigate({ to: "/admin/login" });
    }
  }

  async function handleApplyFilter() {
    if (token) fetchData(token, statusFilter, serviceFilter);
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
      {/* Navbar */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏥</span>
          <div>
            <h1 className="font-bold text-gray-900">Klinik Self Service</h1>
            <p className="text-xs text-gray-400">Admin Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/scan"
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
          >
            📷 Scan Barcode
          </Link>
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
              <option value="registrasi">Registrasi</option>
              <option value="poli_umum">Poli Umum</option>
              <option value="igd">IGD</option>
              <option value="laboratorium">Laboratorium</option>
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
                fetchData(token);
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
              ({data.visits.length} record)
            </span>
          </h2>
          <VisitsTable
            visits={data.visits as any}
            onServe={handleServe}
            onRevoke={handleRevoke}
            onDelete={handleDelete}
            loading={loadingVisit}
          />
        </section>
      </main>
    </div>
  );
}
