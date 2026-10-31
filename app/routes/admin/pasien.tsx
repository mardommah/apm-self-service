import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { AdminHeader } from "~/components/admin/AdminHeader";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { searchSimrsPatientsAction } from "~/server/actions/patient-search";

export const Route = createFileRoute("/admin/pasien")({
  component: PatientSearchPage,
});

type SearchForm = { name: string; birthDate: string; serviceDate: string };
type SearchResult = Awaited<ReturnType<typeof searchSimrsPatientsAction>>;

const EMPTY_FORM: SearchForm = { name: "", birthDate: "", serviceDate: "" };

const ERRORS: Record<string, string> = {
  SEARCH_EMPTY: "Isi minimal satu: nama, tanggal lahir, atau tanggal layanan.",
  NAME_INVALID: "Nama minimal 3 huruf.",
  DATE_INVALID: "Format tanggal tidak valid.",
  PAGE_INVALID: "Halaman tidak valid.",
  SIMRS_NOT_CONFIGURED: "Koneksi SIMRS belum dikonfigurasi di server.",
  SIMRS_UNAVAILABLE: "SIMRS tidak dapat dihubungi. Coba lagi.",
};

/** Cell that shows its column name before the value when the row is a card (< md). */
const CELL = "px-4 py-3 max-md:p-0 max-md:before:mr-1.5 max-md:before:text-xs max-md:before:text-gray-400 max-md:before:content-[attr(data-label)]";

function formatDate(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}-${m}-${y}`;
}

function PatientSearchPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState<SearchForm>(EMPTY_FORM);
  // Filters of the results on screen: paging keeps them even if the form was edited since.
  const [applied, setApplied] = useState<SearchForm>(EMPTY_FORM);
  const [result, setResult] = useState<SearchResult | null>(null);
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

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    search(form, 1);
  }

  async function search(filters: SearchForm, page: number) {
    setError("");
    setLoading(true);
    try {
      setResult(await searchSimrsPatientsAction({ data: { token, ...filters, page } }));
      setApplied(filters);
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

  return (
    <div className="min-h-dvh bg-gray-50">
      <AdminHeader isAdmin={isAdmin} />

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
                  setForm(EMPTY_FORM);
                  setResult(null);
                  setError("");
                }}
              >
                Reset
              </Button>
            </div>
          </form>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        </section>

        {result && (
          <section aria-live="polite">
            <p className="mb-2 text-sm text-gray-600">
              {result.total} pasien ditemukan
              {result.total > 0 &&
                ` · menampilkan ${(result.page - 1) * result.pageSize + 1}–${(result.page - 1) * result.pageSize + result.patients.length}`}
            </p>
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
              <table className="w-full text-left text-sm max-md:block">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 max-md:hidden">
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
                <tbody className="divide-y divide-gray-100 max-md:block">
                  {result.patients.length === 0 && (
                    <tr className="max-md:block"><td colSpan={7} className="px-4 py-6 text-center text-gray-400 max-md:block">Tidak ada pasien yang cocok.</td></tr>
                  )}
                  {result.patients.map((p) => (
                    // Below md: a card, label before each value (`data-label`), name on top.
                    <tr key={p.noRkmMedis} className="hover:bg-gray-50 max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-1.5 max-md:p-4">
                      <td className="px-4 py-3 font-mono font-semibold max-md:p-0">{p.noRkmMedis}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 max-md:col-span-2 max-md:row-start-1 max-md:p-0">{p.name}</td>
                      <td data-label="Tgl. lahir" className={`${CELL} whitespace-nowrap`}>{formatDate(p.birthDate)}</td>
                      <td data-label="NIK" className={`${CELL} max-md:col-span-2 font-mono`}>{p.nik || "—"}</td>
                      <td data-label="Alamat" className={`${CELL} max-md:col-span-2 text-gray-600`}>{p.address || "—"}</td>
                      <td data-label="Kunjungan" className={`${CELL} md:text-right`}>{p.visitCount}</td>
                      <td data-label="Terakhir" className={`${CELL} whitespace-nowrap`}>{formatDate(p.lastVisit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination result={result} loading={loading} onPage={(page) => search(applied, page)} />
          </section>
        )}
      </main>
    </div>
  );
}

function Pagination({ result, loading, onPage }: { result: SearchResult; loading: boolean; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between" aria-label="Pagination pasien">
      <Button variant="outline" disabled={loading || result.page <= 1} onClick={() => onPage(result.page - 1)}>
        ← Sebelumnya
      </Button>
      <span className="text-sm text-gray-600">Halaman {result.page} dari {pages}</span>
      <Button variant="outline" disabled={loading || result.page >= pages} onClick={() => onPage(result.page + 1)}>
        Berikutnya →
      </Button>
    </nav>
  );
}
