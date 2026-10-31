import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminNavLinks } from "~/components/admin/AdminNavLinks";
import { AdminUsersPanel } from "~/components/admin/AdminUsersPanel";
import { BpjsTestAccounts } from "~/components/admin/BpjsTestAccounts";
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
  updateServiceQueuePrefixAction,
} from "~/server/actions/dashboard-settings";
import { DEFAULT_QUEUE_PREFIX, QUEUE_PREFIXES } from "~/lib/queue-prefix";

export const Route = createFileRoute("/admin/pengaturan")({
  component: SettingsPage,
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

/** Application settings (admin role only); was a modal on the dashboard. */
function SettingsPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string>("");
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardDataAction>> | null>(null);
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
  const [savingQueuePrefix, setSavingQueuePrefix] = useState(false);

  useEffect(() => {
    import("~/lib/auth-client").then(({ getToken, isLoggedIn }) => {
      if (!isLoggedIn()) return navigate({ to: "/admin/login" });
      const t = getToken()!;
      setToken(t);
      fetchData(t);
    });
  }, []);

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

  async function handleCreatePoli(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setSavingPoli(true);
    setPoliError("");
    try {
      await createPoliAction({ data: { token, code: poliCode, label: poliLabel } });
      setPoliCode("poli_");
      setPoliLabel("");
      await fetchData(token);
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
      await fetchData(token);
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
      await fetchData(token);
    } finally {
      setSavingBarcode(false);
    }
  }

  async function handleFristaBypassSetting(enabled: boolean) {
    if (!token) return;
    setSavingFristaBypass(true);
    try {
      await updateFristaBypassSettingAction({ data: { token, enabled } });
      await fetchData(token);
    } finally {
      setSavingFristaBypass(false);
    }
  }

  async function handleAutoPrintSetting(enabled: boolean) {
    if (!token) return;
    setSavingAutoPrint(true);
    try {
      await updateAutoPrintSettingAction({ data: { token, enabled } });
      await fetchData(token);
    } finally {
      setSavingAutoPrint(false);
    }
  }

  async function handleBpjsTestAccountsSetting(enabled: boolean) {
    if (!token) return;
    setSavingBpjsTestAccounts(true);
    try {
      await updateBpjsTestAccountsSettingAction({ data: { token, enabled } });
      await fetchData(token);
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
      await fetchData(token);
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
      await fetchData(token);
    } finally {
      setSavingBookingScanner(false);
    }
  }

  async function handleQueuePrefix(serviceCode: string, prefix: string) {
    if (!token) return;
    setSavingQueuePrefix(true);
    try {
      await updateServiceQueuePrefixAction({ data: { token, serviceCode, prefix } });
      await fetchData(token);
    } finally {
      setSavingQueuePrefix(false);
    }
  }

  async function handleDisplayPlaylist(event: React.FormEvent) {
    event.preventDefault();
    if (!token || displayPlaylist === null) return;
    setSavingDisplayPlaylist(true);
    try {
      await updateDisplayPlaylistAction({ data: { token, playlist: displayPlaylist } });
      await fetchData(token);
      setDisplayPlaylist(null);
    } catch {
      alert("URL / ID YouTube tidak valid. Pakai satu playlist, atau beberapa video (maks. ±20).");
    } finally {
      setSavingDisplayPlaylist(false);
    }
  }

  async function handleLogout() {
    const { clearToken } = await import("~/lib/auth-client");
    clearToken();
    navigate({ to: "/admin/login" });
  }

  if (!data) return <div className="grid min-h-dvh place-items-center text-gray-400">Memuat…</div>;

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-center gap-6">
          <h1 className="font-bold text-gray-900">🏥 Klinik Syamsinar Maros</h1>
          <AdminNavLinks isAdmin={data.admin.role === "admin"} />
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout}>Keluar</Button>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <h2 className="text-xl font-semibold text-gray-800">Pengaturan Aplikasi</h2>
        {data.admin.role !== "admin" ? (
          <p className="mt-4 rounded-lg border bg-white p-4 text-gray-600">Halaman ini khusus akun dengan role admin.</p>
        ) : (
          <section className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
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
                  Nomor & QR dummy untuk menguji scanner, tampil di bawah ini.
                </p>
              </div>
              <SettingSwitch
                checked={data.showBpjsTestAccounts}
                disabled={savingBpjsTestAccounts}
                label="Tampilkan akun BPJS pengujian"
                onChange={handleBpjsTestAccountsSetting}
              />
            </div>
            {data.showBpjsTestAccounts && (
              <div className="mt-2">
                <BpjsTestAccounts />
              </div>
            )}

            <div className="mt-4 rounded-lg border p-4">
              <p className="font-medium text-gray-800">Prefix nomor antrean</p>
              <p className="text-sm text-gray-500">
                A = antrean Loket, B = antrean CS di mLITE. Tiket tampil mis. A001, di mLITE tersimpan nomor 1.
              </p>
              <div className="mt-3 divide-y">
                {data.services
                  .filter((service) => service.code in DEFAULT_QUEUE_PREFIX)
                  .map((service) => (
                    <label key={service.code} className="flex items-center justify-between gap-4 py-2">
                      <span className="text-sm text-gray-700">{service.label}</span>
                      <select
                        value={service.queuePrefix ?? DEFAULT_QUEUE_PREFIX[service.code]}
                        disabled={savingQueuePrefix}
                        onChange={(event) => handleQueuePrefix(service.code, event.target.value)}
                        aria-label={`Prefix antrean ${service.label}`}
                        className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm font-semibold disabled:opacity-60"
                      >
                        {QUEUE_PREFIXES.map((prefix) => (
                          <option key={prefix} value={prefix}>{prefix}xx</option>
                        ))}
                      </select>
                    </label>
                  ))}
              </div>
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
                  Satu URL playlist, atau beberapa URL video (satu per baris) untuk layar TV <code>/display</code>. Maksimal ±20 video. Kosongkan untuk menyembunyikan video.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <textarea
                  rows={3}
                  value={displayPlaylist ?? data.displayYoutubePlaylist.split(",").join("\n")}
                  onChange={(event) => setDisplayPlaylist(event.target.value)}
                  placeholder={"https://www.youtube.com/watch?v=...\nhttps://youtu.be/..."}
                  aria-label="Video YouTube display"
                  className="w-72 rounded-md border border-gray-300 px-3 py-2 text-sm"
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
        )}
      </main>
    </div>
  );
}
