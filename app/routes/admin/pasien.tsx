import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AdminNavLinks } from "~/components/admin/AdminNavLinks";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { searchSimrsPatientsAction } from "~/server/actions/patient-search";
import type { SimrsPatient } from "~/server/simrs";

export const Route = createFileRoute("/admin/pasien")({
  component: PatientSearchPage,
});

const LIMIT = 50; // = SIMRS_PATIENT_SEARCH_LIMIT (server)

const ERRORS: Record<string, string> = {
  SEARCH_EMPTY: "Isi minimal satu: nama, tanggal lahir, atau tanggal layanan.",
  NAME_INVALID: "Nama minimal 3 huruf.",
  DATE_INVALID: "Format tanggal tidak valid.",
  SIMRS_NOT_CONFIGURED: "Koneksi SIMRS belum dikonfigurasi di server.",
  SIMRS_UNAVAILABLE: "SIMRS tidak dapat dihubungi. Coba lagi.",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}-${m}-${y}`;
}

function PatientSearchPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState({ name: "", birthDate: "", serviceDate: "" });
  const [results, setResults] = useState<SimrsPatient[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      setResults(await searchSimrsPatientsAction({ data: { token, ...form } }));
    } catch (err) {
      const { clearToken, isUnauthorized } = await import("~/lib/auth-client");
      if (isUnauthorized(err)) {
        clearToken();
        navigate({ to: "/admin/login" });
        return;
      }
      const code = Object.keys(ERRORS).find((key) => err instanceof Error && err.message.includes(key));
      setError(code ? ERRORS[code] : "Pencarian gagal.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    const { clearToken } = await import("~/lib/auth-client");
    clearToken();
    navigate({ to: "/admin/login" });
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-6">
          <h1 className="font-bold text-gray-900">🏥 Klinik Syamsinar Maros</h1>
          <AdminNavLinks isAdmin={isAdmin} />
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>Keluar</Button>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <section>
          <h2 className="mb-1 text-lg font-semibold text-gray-800">Cari Data Pasien SIMRS</h2>
          <p className="mb-3 text-sm text-gray-500">
            Isi satu atau lebih kolom; semua yang diisi harus cocok. Nama dicari dari awalan (mis. "SITI AMINAH").
          </p>
          <form onSubmit={handleSearch} className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-4 sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="patient-name">Nama pasien</Label>
              <Input
                id="patient-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Awalan nama"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="patient-birth">Tanggal lahir</Label>
              <Input
                id="patient-birth"
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="patient-service">Tanggal layanan</Label>
              <Input
                id="patient-service"
                type="date"
                value={form.serviceDate}
                onChange={(e) => setForm({ ...form, serviceDate: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading || !token} className="flex-1">
                {loading ? "Mencari…" : "🔍 Cari"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setForm({ name: "", birthDate: "", serviceDate: "" });
                  setResults(null);
                  setError("");
                }}
              >
                Reset
              </Button>
            </div>
          </form>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        </section>

        {results && (
          <section aria-live="polite">
            <p className="mb-2 text-sm text-gray-600">
              {results.length} pasien ditemukan
              {results.length >= LIMIT && ` (dibatasi ${LIMIT}; persempit pencarian)`}
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">No. RM</th>
                    <th className="px-4 py-3">Nama</th>
                    <th className="px-4 py-3">Tgl. Lahir</th>
                    <th className="px-4 py-3">NIK</th>
                    <th className="px-4 py-3">Alamat</th>
                    <th className="px-4 py-3 text-right">Kunjungan</th>
                    <th className="px-4 py-3">Kunjungan Terakhir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Tidak ada pasien yang cocok.</td></tr>
                  )}
                  {results.map((p) => (
                    <tr key={p.noRkmMedis} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-semibold">{p.noRkmMedis}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(p.birthDate)}</td>
                      <td className="px-4 py-3 font-mono">{p.nik || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{p.address || "—"}</td>
                      <td className="px-4 py-3 text-right">{p.visitCount}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(p.lastVisit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
