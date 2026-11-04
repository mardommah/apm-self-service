import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdminHeader } from "~/components/admin/AdminHeader";
import { DisplayCallTest } from "~/components/admin/DisplayCallTest";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { listPoliCallsAction, type PoliCallHistory } from "~/server/actions/display-poli";

export const Route = createFileRoute("/admin/riwayat-poli")({
  head: () => ({ meta: [{ title: "Riwayat Panggilan Poli · Klinik Syamsinar" }] }),
  component: PoliHistoryPage,
});

const REFRESH_MS = 30_000;
/** Cell that shows its column name before the value when the row is a card (< md). */
const CELL = "px-4 py-3 max-md:p-0 max-md:before:mr-1.5 max-md:before:text-xs max-md:before:text-gray-400 max-md:before:content-[attr(data-label)]";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
const time = (value: Date | string | null) =>
  value
    ? new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value))
    : "—";

function PoliHistoryPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [date, setDate] = useState(today);
  const [poli, setPoli] = useState("");
  const [calls, setCalls] = useState<PoliCallHistory | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { getToken, isLoggedIn, getAdminRole } = await import("~/lib/auth-client");
      if (!isLoggedIn()) {
        navigate({ to: "/admin/login" });
        return;
      }
      setToken(getToken()!);
      setIsAdmin(getAdminRole() === "admin");
    })();
  }, []);

  useEffect(() => {
    if (!token || !date) return;
    let stopped = false;
    async function load() {
      try {
        const rows = await listPoliCallsAction({ data: { token, date } });
        if (!stopped) (setCalls(rows), setError(""));
      } catch (err) {
        const { clearToken, isUnauthorized } = await import("~/lib/auth-client");
        if (isUnauthorized(err)) {
          clearToken();
          navigate({ to: "/admin/login" });
          return;
        }
        if (!stopped) setError("Riwayat tidak dapat dimuat.");
      }
    }
    setCalls(null);
    load();
    // Only today's list still changes.
    const timer = date === today() ? setInterval(load, REFRESH_MS) : undefined;
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [token, date]);

  const polis = useMemo(() => [...new Set((calls ?? []).map((c) => c.poli))].sort(), [calls]);
  const shown = (calls ?? []).filter((c) => !poli || c.poli === poli);

  return (
    <div className="min-h-dvh bg-gray-50">
      <AdminHeader isAdmin={isAdmin} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section>
          <h2 className="mb-1 text-lg font-semibold text-gray-800">Riwayat Panggilan Poli</h2>
          <p className="mb-3 text-sm text-gray-500">
            Dicatat dari panggilan SIMRS (Khanza) yang terbaca oleh display poli. "Selesai" = dokter yang sama sudah memanggil pasien berikutnya.
          </p>
          <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-3 sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="poli-date">Tanggal</Label>
              <Input id="poli-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="poli-filter">Poli</Label>
              <select
                id="poli-filter"
                value={poli}
                onChange={(e) => setPoli(e.target.value)}
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
              >
                <option value="">Semua poli</option>
                {polis.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <p className="text-sm text-gray-600" aria-live="polite">
              {calls === null ? "Memuat…" : `${shown.length} panggilan · ${shown.filter((c) => c.isRecall).length} panggil ulang`}
            </p>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          {/* Server allows the TV test for the admin role only. */}
          {isAdmin && token && (
            <div className="bg-white">
              <DisplayCallTest token={token} target="poli" />
            </div>
          )}
        </section>

        <section className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm max-md:block">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 max-md:hidden">
              <tr>
                <th className="px-4 py-3">Jam Panggil</th>
                <th className="px-4 py-3">Nomor</th>
                <th className="px-4 py-3">Pasien</th>
                <th className="px-4 py-3">No. Rawat</th>
                <th className="px-4 py-3">Poli</th>
                <th className="px-4 py-3">Dokter</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 max-md:block">
              {calls?.length === 0 || (calls && shown.length === 0) ? (
                <tr className="max-md:block"><td colSpan={8} className="px-4 py-6 text-center text-gray-400 max-md:block">Belum ada panggilan.</td></tr>
              ) : null}
              {shown.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-1.5 max-md:p-4">
                  <td data-label="Jam" className={`${CELL} whitespace-nowrap font-mono`}>{time(c.calledAt)}</td>
                  <td className="px-4 py-3 font-mono font-semibold max-md:p-0">{c.queueNumber}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-md:col-span-2 max-md:row-start-1 max-md:p-0">{c.pasien}</td>
                  <td data-label="No. rawat" className={`${CELL} font-mono text-gray-600 max-md:col-span-2`}>{c.noRawat}</td>
                  <td data-label="Poli" className={`${CELL} max-md:col-span-2`}>{c.poli}</td>
                  <td data-label="Dokter" className={`${CELL} text-gray-600 max-md:col-span-2`}>{c.dokter}</td>
                  <td data-label="Jenis" className={CELL}>{c.isRecall ? "Panggil ulang" : "Panggilan"}</td>
                  <td data-label="Status" className={`${CELL} whitespace-nowrap`}>
                    {c.finishedAt ? (
                      <span className="text-gray-600">Selesai {time(c.finishedAt)}</span>
                    ) : (
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">Dipanggil</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
