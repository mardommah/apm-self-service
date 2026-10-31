import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminNavLinks } from "~/components/admin/AdminNavLinks";
import { StatsCards } from "~/components/admin/StatsCards";
import { useAdminVisits } from "~/components/admin/useAdminVisits";
import { defaultFilters, todayString, VisitFilters } from "~/components/admin/VisitFilters";
import { VisitsTable } from "~/components/admin/VisitsTable";
import { Button } from "~/components/ui/button";

export const Route = createFileRoute("/admin/kunjungan")({
  component: VisitsPage,
});

function VisitsPage() {
  const navigate = useNavigate();
  const { token, data, filters, setFilters, applied, page, loadingVisit, fetchData, actions } = useAdminVisits();

  async function handleLogout() {
    const { clearToken } = await import("~/lib/auth-client");
    clearToken();
    navigate({ to: "/admin/login" });
  }

  if (!data) return <div className="grid min-h-dvh place-items-center text-gray-400">Memuat…</div>;

  const pages = Math.max(1, Math.ceil(data.totalVisits / data.pageSize));
  const isToday = applied.dateFrom === todayString() && applied.dateTo === todayString();
  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-6">
          <h1 className="font-bold text-gray-900">🏥 Klinik Syamsinar Maros</h1>
          <AdminNavLinks isAdmin={data.admin.role === "admin"} />
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>Keluar</Button>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">
            {isToday ? "Daftar Kunjungan Hari Ini" : "Daftar Kunjungan"}
            <span className="ml-2 text-sm font-normal text-gray-400">({data.totalVisits} kunjungan)</span>
          </h2>
          <div className="mb-3 rounded-xl border border-gray-200 bg-white">
            <VisitFilters
              filters={filters}
              services={data.services}
              onChange={setFilters}
              onApply={() => fetchData(token, filters, 1)}
              onReset={() => {
                setFilters(defaultFilters());
                fetchData(token, defaultFilters(), 1);
              }}
            />
          </div>
          <VisitsTable
            visits={data.visits as any}
            onServe={actions.serve}
            onRevoke={actions.revoke}
            onDelete={actions.remove}
            onCall={actions.call}
            onFinish={actions.finish}
            loading={loadingVisit}
          />
          <nav className="mt-4 flex items-center justify-between" aria-label="Pagination kunjungan">
            <Button variant="outline" disabled={page <= 1} onClick={() => fetchData(token, applied, page - 1)}>
              ← Sebelumnya
            </Button>
            <span className="text-sm text-gray-600">Halaman {page} dari {pages}</span>
            <Button variant="outline" disabled={page >= pages} onClick={() => fetchData(token, applied, page + 1)}>
              Berikutnya →
            </Button>
          </nav>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">Ringkasan Hari Ini</h2>
          <StatsCards stats={data.stats as any} />
        </section>
      </main>
    </div>
  );
}
