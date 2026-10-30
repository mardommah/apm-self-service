import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AdminUsersPanel } from "~/components/admin/AdminUsersPanel";
import { LoketCaller } from "~/components/admin/LoketCaller";
import { StatsCards } from "~/components/admin/StatsCards";
import { VisitsTable } from "~/components/admin/VisitsTable";
import { Button } from "~/components/ui/button";
import { getDashboardDataAction } from "~/server/actions/dashboard-data";
import { createPoliAction, updatePoliAction } from "~/server/actions/dashboard-poli";
import {
  updateBarcodeSettingAction,
  updateAutoPrintSettingAction,
  updateBookingScannerSettingAction,
  updateFristaBypassSettingAction,
  updateBpjsTestAccountsSettingAction,
  updateDisplayPlaylistAction,
  updateKioskReturnSecondsAction,
} from "~/server/actions/dashboard-settings";
import { callVisitAction, finishVisitAction } from "~/server/actions/display";
import { deleteAction, revokeAction, serveAction } from "~/server/actions/dashboard-visits";

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardPage,
});

function SettingSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`${label}: ${checked ? "Aktif" : "Nonaktif"}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex shrink-0 items-center gap-3 rounded-full p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className={`relative h-8 w-14 rounded-full transition-colors ${checked ? "bg-green-600" : "bg-gray-300"}`}
      >
        <span
          className={`absolute left-0 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-7" : "translate-x-1"}`}
        />
      </span>
      <span className={`min-w-16 text-left text-sm font-semibold ${checked ? "text-green-700" : "text-gray-600"}`}>
        {checked ? "Aktif" : "Nonaktif"}
      </span>
    </button>
  );
}

const LOKET_COUNT = 9;
const LOKET_STORAGE_KEY = "admin-loket";

type Filters = { status: string; serviceCode: string; dateFrom: string; dateTo: string; search: string };

function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultFilters(): Filters {
  const today = todayString();
  return { status: "", serviceCode: "", dateFrom: today, dateTo: today, search: "" };
}

function DashboardPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string>("");
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardDataAction>> | null>(null);
  const [loadingVisit, setLoadingVisit] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  // Filters the current table data was fetched with; edits in the form apply only on submit.
  const [appliedFilters, setAppliedFilters] = useState<Filters>(defaultFilters);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [page, setPage] = useState(1);
  const [poliCode, setPoliCode] = useState("poli_");
  const [poliLabel, setPoliLabel] = useState("");
  const [poliError, setPoliError] = useState("");
  const [savingPoli, setSavingPoli] = useState(false);
  const [poliModalOpen, setPoliModalOpen] = useState(false);
  const [savingBarcode, setSavingBarcode] = useState(false);
  const [savingBookingScanner, setSavingBookingScanner] = useState(false);
  const [savingAutoPrint, setSavingAutoPrint] = useState(false);
  const [savingBpjsTestAccounts, setSavingBpjsTestAccounts] = useState(false);
  const [savingFristaBypass, setSavingFristaBypass] = useState(false);
  const [kioskReturnSeconds, setKioskReturnSeconds] = useState<string | null>(null);
  const [savingKioskReturn, setSavingKioskReturn] = useState(false);
  const [displayPlaylist, setDisplayPlaylist] = useState<string | null>(null);
  const [savingDisplayPlaylist, setSavingDisplayPlaylist] = useState(false);
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
      fetchData(t, defaultFilters(), 1);
    }
    init();
  }, []);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(LOKET_STORAGE_KEY));
      if (saved >= 1 && saved <= LOKET_COUNT) setLoket(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!token || !autoRefresh) return;
    const interval = setInterval(
      () => fetchData(token, appliedFilters, page),
      30_000,
    );
    return () => clearInterval(interval);
  }, [token, autoRefresh, appliedFilters, page]);

  async function fetchData(t: string, f: Filters = appliedFilters, targetPage = page) {
    try {
      const result = await getDashboardDataAction({ data: { token: t, ...f, page: targetPage } });
      setAppliedFilters(f);
      setData(result);
      setPage(result.page);
    } catch {
      navigate({ to: "/admin/login" });
    }
  }

  async function handleApplyFilter(event?: React.FormEvent) {
    event?.preventDefault();
    if (token) fetchData(token, filters, 1);
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
      await fetchData(token, appliedFilters, page);
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
      await fetchData(token, appliedFilters, page);
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
      await fetchData(token, appliedFilters, page);
    } finally {
      setSavingBarcode(false);
    }
  }

  async function handleFristaBypassSetting(enabled: boolean) {
    if (!token) return;
    setSavingFristaBypass(true);
    try {
      await updateFristaBypassSettingAction({ data: { token, enabled } });
      await fetchData(token, appliedFilters, page);
    } finally {
      setSavingFristaBypass(false);
    }
  }

  async function handleAutoPrintSetting(enabled: boolean) {
    if (!token) return;
    setSavingAutoPrint(true);
    try {
      await updateAutoPrintSettingAction({ data: { token, enabled } });
      await fetchData(token, appliedFilters, page);
    } finally {
      setSavingAutoPrint(false);
    }
  }

  async function handleBpjsTestAccountsSetting(enabled: boolean) {
    if (!token) return;
    setSavingBpjsTestAccounts(true);
    try {
      await updateBpjsTestAccountsSettingAction({ data: { token, enabled } });
      await fetchData(token, appliedFilters, page);
    } finally {
      setSavingBpjsTestAccounts(false);
    }
  }

  async function handleKioskReturnSeconds(event: React.FormEvent) {
    event.preventDefault();
    if (!token || kioskReturnSeconds === null) return;
    setSavingKioskReturn(true);
    try {
      await updateKioskReturnSecondsAction({ data: { token, seconds: Number(kioskReturnSeconds) } });
      await fetchData(token, appliedFilters, page);
      setKioskReturnSeconds(null);
    } finally {
      setSavingKioskReturn(false);
    }
  }

  async function handleBookingScannerSetting(enabled: boolean) {
    if (!token) return;
    setSavingBookingScanner(true);
    try {
      await updateBookingScannerSettingAction({ data: { token, enabled } });
      await fetchData(token, appliedFilters, page);
    } finally {
      setSavingBookingScanner(false);
    }
  }

  async function handleServe(visitId: string) {
    if (!token) return;
    setLoadingVisit(visitId);
    try {
      await serveAction({ data: { token, visitId } });
      fetchData(token);
    } finally {
      setLoadingVisit(null);
    }
  }

  async function handleRevoke(visitId: string) {
    if (!token) return;
    setLoadingVisit(visitId);
    try {
      await revokeAction({ data: { token, visitId } });
      fetchData(token);
    } finally {
      setLoadingVisit(null);
    }
  }

  async function handleDelete(visitId: string) {
    if (!token) return;
    setLoadingVisit(visitId);
    try {
      await deleteAction({ data: { token, visitId } });
      fetchData(token);
    } finally {
      setLoadingVisit(null);
    }
  }

  async function handleCall(visit: { id: string }) {
    if (!token) return;
    setLoadingVisit(visit.id);
    try {
      await callVisitAction({ data: { token, visitId: visit.id, loket } });
    } catch {
      alert("Gagal memanggil antrian. Coba lagi.");
    } finally {
      setLoadingVisit(null);
    }
  }

  async function handleFinish(visitId: string) {
    if (!token) return;
    setLoadingVisit(visitId);
    try {
      await finishVisitAction({ data: { token, visitId } });
      fetchData(token, appliedFilters, page);
    } catch {
      alert("Gagal menandai selesai. Coba lagi.");
    } finally {
      setLoadingVisit(null);
    }
  }

  function handleLoketChange(value: number) {
    setLoket(value);
    try {
      localStorage.setItem(LOKET_STORAGE_KEY, String(value));
    } catch {}
  }

  async function handleDisplayPlaylist(event: React.FormEvent) {
    event.preventDefault();
    if (!token || displayPlaylist === null) return;
    setSavingDisplayPlaylist(true);
    try {
      await updateDisplayPlaylistAction({ data: { token, playlist: displayPlaylist } });
      await fetchData(token, appliedFilters, page);
      setDisplayPlaylist(null);
    } catch {
      alert("ID / URL playlist YouTube tidak valid.");
    } finally {
      setSavingDisplayPlaylist(false);
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
              <SettingSwitch
                checked={data.barcodeEnabled}
                disabled={savingBarcode}
                label="Fitur barcode / QR"
                onChange={handleBarcodeSetting}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <p className="font-medium text-gray-800">Cetak struk otomatis</p>
                <p className="text-sm text-gray-500">
                  Struk antrean langsung dicetak saat halaman tiket kiosk terbuka. Tombol cetak manual tetap tersedia.
                </p>
              </div>
              <SettingSwitch
                checked={data.autoPrintEnabled}
                disabled={savingAutoPrint}
                label="Cetak struk otomatis"
                onChange={handleAutoPrintSetting}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <p className="font-medium text-gray-800">Tampilkan akun BPJS pengujian</p>
                <p className="text-sm text-gray-500">
                  Panel nomor & QR dummy untuk menguji scanner di bagian atas dashboard.
                </p>
              </div>
              <SettingSwitch
                checked={data.showBpjsTestAccounts}
                disabled={savingBpjsTestAccounts}
                label="Tampilkan akun BPJS pengujian"
                onChange={handleBpjsTestAccountsSetting}
              />
            </div>

            <form
              onSubmit={handleKioskReturnSeconds}
              className="mt-4 flex items-center justify-between gap-4 rounded-lg border p-4"
            >
              <div>
                <p className="font-medium text-gray-800">Kembali otomatis (detik)</p>
                <p className="text-sm text-gray-500">
                  Halaman tiket kiosk (QR & cetak) kembali ke beranda setelah waktu ini. 5–600 detik.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <input
                  type="number"
                  min={5}
                  max={600}
                  step={1}
                  required
                  value={kioskReturnSeconds ?? String(data.kioskReturnSeconds)}
                  onChange={(event) => setKioskReturnSeconds(event.target.value)}
                  aria-label="Kembali otomatis (detik)"
                  className="h-10 w-20 rounded-md border border-gray-300 px-3 text-sm"
                />
                <Button type="submit" size="sm" disabled={savingKioskReturn}>
                  Simpan
                </Button>
              </div>
            </form>

            <form
              onSubmit={handleDisplayPlaylist}
              className="mt-4 flex items-center justify-between gap-4 rounded-lg border p-4"
            >
              <div>
                <p className="font-medium text-gray-800">Video YouTube display</p>
                <p className="text-sm text-gray-500">
                  URL / ID playlist atau satu video untuk layar TV <code>/display</code>. Kosongkan untuk menyembunyikan video.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <input
                  type="text"
                  value={displayPlaylist ?? data.displayYoutubePlaylist}
                  onChange={(event) => setDisplayPlaylist(event.target.value)}
                  placeholder="PLxxxxxxxx"
                  aria-label="Playlist YouTube display"
                  className="h-10 w-64 rounded-md border border-gray-300 px-3 text-sm"
                />
                <Button type="submit" size="sm" disabled={savingDisplayPlaylist}>
                  Simpan
                </Button>
              </div>
            </form>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border p-4">
              <div>
                <p className="font-medium text-gray-800">Scanner barcode booking</p>
                <p className="text-sm text-gray-500">
                  Jika nonaktif, pasien lama check-in manual memakai nomor kartu BPJS saja.
                </p>
              </div>
              <SettingSwitch
                checked={data.bookingScannerEnabled}
                disabled={savingBookingScanner}
                label="Scanner barcode booking"
                onChange={handleBookingScannerSetting}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <div>
                <p className="font-medium text-amber-900">Bypass check-in FKTL ke Frista</p>
                <p className="text-sm text-amber-700">
                  Booking SIM RS tetap dicek. Dalam mode uji, nomor kartu 13 digit tanpa booking diteruskan ke Frista tanpa validasi FKTL atau cetak bukti.
                </p>
              </div>
              <SettingSwitch
                checked={data.fristaBypassEnabled}
                disabled={savingFristaBypass}
                label="Bypass check-in FKTL ke Frista"
                onChange={handleFristaBypassSetting}
              />
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
            <AdminUsersPanel token={token} />
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
        {data.showBpjsTestAccounts && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="font-semibold text-amber-900">Akun BPJS untuk pengujian</h2>
            <p className="mt-1 text-sm text-amber-800">
              Nomor dan QR berikut data dummy untuk menguji scanner. Keduanya tidak terdaftar sebagai peserta BPJS; validasi FKTL dan biometrik Frista dapat gagal.
            </p>
            <ul className="mt-3 flex flex-wrap gap-3">
              {[
                { number: "0000000000001", qr: "/dev/bpjs-checkin-dummy-qr.png" },
                { number: "0000000000002", qr: "/dev/bpjs-checkin-dummy-qr-2.png" },
              ].map(({ number, qr }) => (
                <li key={number} className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <code className="font-semibold text-gray-900">{number}</code>
                  <a href={qr} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-700 underline">
                    Lihat QR
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

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
                onClick={() => fetchData(token)}
              >
                🔄 Refresh
              </Button>
            </div>
          </div>
          <StatsCards stats={data.stats as any} />
        </section>

        {/* Filters */}
        <form
          onSubmit={handleApplyFilter}
          className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end"
        >
          <div className="flex flex-col gap-1 min-w-[220px] flex-1">
            <label htmlFor="visit-search" className="text-xs font-medium text-gray-600">Cari</label>
            <input
              id="visit-search"
              type="search"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="No. kunjungan, layanan, atau nomor offline (O001)"
              className="h-9 px-3 rounded-md border border-gray-300 text-sm bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="visit-date-from" className="text-xs font-medium text-gray-600">Dari Tanggal</label>
            <input
              id="visit-date-from"
              type="date"
              value={filters.dateFrom}
              max={filters.dateTo || undefined}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="h-9 px-3 rounded-md border border-gray-300 text-sm bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="visit-date-to" className="text-xs font-medium text-gray-600">Sampai Tanggal</label>
            <input
              id="visit-date-to"
              type="date"
              value={filters.dateTo}
              min={filters.dateFrom || undefined}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="h-9 px-3 rounded-md border border-gray-300 text-sm bg-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="visit-status" className="text-xs font-medium text-gray-600">Status</label>
            <select
              id="visit-status"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="h-9 px-3 rounded-md border border-gray-300 text-sm bg-white"
            >
              <option value="">Semua Status</option>
              <option value="waiting">Menunggu</option>
              <option value="served">Dilayani</option>
              <option value="revoked">Dibatalkan</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="visit-service" className="text-xs font-medium text-gray-600">Layanan</label>
            <select
              id="visit-service"
              value={filters.serviceCode}
              onChange={(e) => setFilters({ ...filters, serviceCode: e.target.value })}
              className="h-9 px-3 rounded-md border border-gray-300 text-sm bg-white"
            >
              <option value="">Semua Layanan</option>
              {data.services.map((service) => (
                <option key={service.code} value={service.code}>{service.label}</option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm">
            Terapkan Filter
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const reset = defaultFilters();
              setFilters(reset);
              fetchData(token, reset, 1);
            }}
          >
            Hari Ini
          </Button>
        </form>

        {token && <LoketCaller token={token} loket={loket} onChange={() => fetchData(token)} />}

        {/* Table */}
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-800">
              {appliedFilters.dateFrom === todayString() && appliedFilters.dateTo === todayString()
                ? "Antrian Hari Ini"
                : "Daftar Kunjungan"}
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({data.totalVisits} record)
              </span>
            </h2>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Loket saya
              <select
                value={loket}
                onChange={(e) => handleLoketChange(Number(e.target.value))}
                className="h-9 px-3 rounded-md border border-gray-300 text-sm bg-white"
              >
                {Array.from({ length: LOKET_COUNT }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>Loket {n}</option>
                ))}
              </select>
            </label>
          </div>
          <VisitsTable
            visits={data.visits as any}
            onServe={handleServe}
            onRevoke={handleRevoke}
            onDelete={handleDelete}
            onCall={handleCall}
            onFinish={handleFinish}
            loading={loadingVisit}
          />
          <nav className="mt-4 flex items-center justify-between" aria-label="Pagination kunjungan">
              <Button
                variant="outline"
                disabled={page <= 1}
                onClick={() => fetchData(token, appliedFilters, page - 1)}
              >
                ← Sebelumnya
              </Button>
              <span className="text-sm text-gray-600">
                Halaman {page} dari {Math.ceil(data.totalVisits / data.pageSize)}
              </span>
              <Button
                variant="outline"
                disabled={page >= Math.ceil(data.totalVisits / data.pageSize)}
                onClick={() => fetchData(token, appliedFilters, page + 1)}
              >
                Berikutnya →
              </Button>
          </nav>
        </section>
      </main>
    </div>
  );
}
