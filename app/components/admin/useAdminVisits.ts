import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getSavedLoket } from "~/lib/admin-loket";
import { getDashboardDataAction } from "~/server/actions/dashboard-data";
import { deleteAction, revokeAction, serveAction } from "~/server/actions/dashboard-visits";
import { callVisitAction, finishVisitAction } from "~/server/actions/display";
import { defaultFilters, type Filters } from "./VisitFilters";

/** Data + actions for the visits page: filters apply on submit, auto refresh every 30s. */
export function useAdminVisits() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardDataAction>> | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [applied, setApplied] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const [loadingVisit, setLoadingVisit] = useState<string | null>(null);

  async function fetchData(t: string, f: Filters = applied, targetPage = page) {
    try {
      const result = await getDashboardDataAction({ data: { token: t, ...f, page: targetPage } });
      setApplied(f);
      setData(result);
      setPage(result.page);
    } catch {
      navigate({ to: "/admin/login" });
    }
  }

  useEffect(() => {
    import("~/lib/auth-client").then(({ getToken, isLoggedIn }) => {
      if (!isLoggedIn()) return navigate({ to: "/admin/login" });
      const t = getToken()!;
      setToken(t);
      fetchData(t, defaultFilters(), 1);
    });
  }, []);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => fetchData(token, applied, page), 30_000);
    return () => clearInterval(id);
  }, [token, applied, page]);

  async function run(visitId: string, action: () => Promise<unknown>, failMessage?: string) {
    setLoadingVisit(visitId);
    try {
      await action();
      await fetchData(token);
    } catch {
      if (failMessage) alert(failMessage);
    } finally {
      setLoadingVisit(null);
    }
  }

  const actions = {
    serve: (visitId: string) => run(visitId, () => serveAction({ data: { token, visitId } })),
    revoke: (visitId: string) => run(visitId, () => revokeAction({ data: { token, visitId } })),
    remove: (visitId: string) => run(visitId, () => deleteAction({ data: { token, visitId } })),
    call: (visit: { id: string }) =>
      run(visit.id, () => callVisitAction({ data: { token, visitId: visit.id, loket: getSavedLoket() } }), "Gagal memanggil antrian. Coba lagi."),
    finish: (visitId: string) =>
      run(visitId, () => finishVisitAction({ data: { token, visitId } }), "Gagal menandai selesai. Coba lagi."),
  };

  return { token, data, filters, setFilters, applied, page, loadingVisit, fetchData, actions };
}
