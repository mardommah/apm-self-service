import { useState } from "react";
import { Button } from "~/components/ui/button";
import { DISPLAY_UTC_OFFSET } from "~/components/display/displayConfig";
import { displayToday } from "~/components/display/displayRunningText";
import {
  computePrayerMinutes,
  formatMinutes,
  PRAYER_LABELS,
  PRAYER_LOCATION_PRESETS,
  PRAYER_NAMES,
  type PrayerSettings,
} from "~/lib/prayer-times";
import { testPrayerAnnouncementAction, updatePrayerSettingsAction } from "~/server/actions/dashboard-settings";

/** Jadwal sholat on the TV running text: location (Maros & sekitarnya or custom coordinates) and minute corrections. */
export function PrayerTimesSettings({ token, value, onSaved }: { token: string; value: PrayerSettings; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState<PrayerSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const settings = draft ?? value;
  const edit = (patch: Partial<PrayerSettings>) => setDraft({ ...settings, ...patch });
  const preset = PRAYER_LOCATION_PRESETS.find(
    (p) => p.location === settings.location && p.latitude === settings.latitude && p.longitude === settings.longitude,
  );
  const minutes = computePrayerMinutes(displayToday(), settings, DISPLAY_UTC_OFFSET);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    try {
      await updatePrayerSettingsAction({ data: { token, settings: draft } });
      await onSaved();
      setDraft(null);
    } catch {
      alert("Jadwal sholat gagal disimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function testOnDisplay() {
    setTesting(true);
    setTestSent(false);
    try {
      await testPrayerAnnouncementAction({ data: { token } });
      setTestSent(true);
    } catch {
      alert("Tes pengumuman gagal dikirim. Coba lagi.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-4 space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-gray-800">Jadwal sholat di running text</p>
          <p className="text-sm text-gray-500">
            Dihitung otomatis metode Kemenag (Subuh 20°, Isya 18°, ihtiyat 2 menit) untuk layar TV <code>/display</code>.
            Koreksi menit dipakai bila berbeda dengan jadwal masjid setempat.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => edit({ enabled: e.target.checked })} />
          Tampilkan
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="text-sm text-gray-600">
          Wilayah
          <select
            value={preset?.location ?? ""}
            onChange={(e) => {
              const next = PRAYER_LOCATION_PRESETS.find((p) => p.location === e.target.value);
              if (next) edit(next);
            }}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5"
          >
            {PRAYER_LOCATION_PRESETS.map((p) => (
              <option key={p.location} value={p.location}>{p.location}</option>
            ))}
            <option value="" disabled>Lainnya (koordinat sendiri)</option>
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Nama tampil
          <input
            value={settings.location}
            maxLength={60}
            onChange={(e) => edit({ location: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm text-gray-600">
          Lintang
          <input
            type="number"
            step="0.0001"
            min={-90}
            max={90}
            value={settings.latitude}
            onChange={(e) => edit({ latitude: Number(e.target.value) })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm text-gray-600">
          Bujur
          <input
            type="number"
            step="0.0001"
            min={-180}
            max={180}
            value={settings.longitude}
            onChange={(e) => edit({ longitude: Number(e.target.value) })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5"
          />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {PRAYER_NAMES.map((name) => (
          <label key={name} className="text-sm text-gray-600">
            {PRAYER_LABELS[name]} <span className="font-mono text-gray-900">{formatMinutes(minutes[name])}</span>
            <input
              type="number"
              min={-30}
              max={30}
              value={settings.adjust[name]}
              onChange={(e) => edit({ adjust: { ...settings.adjust, [name]: Number(e.target.value) } })}
              aria-label={`Koreksi menit ${PRAYER_LABELS[name]}`}
              title="Koreksi menit (±30)"
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3">
        {testSent && (
          <span className="text-sm text-gray-500">Terkirim. Layar TV memutar pengumuman dalam ±2 detik (pengaturan tersimpan yang dipakai).</span>
        )}
        <Button type="button" size="sm" variant="outline" disabled={testing} onClick={testOnDisplay}>
          🔊 Tes pengumuman di TV
        </Button>
        <Button type="submit" size="sm" disabled={saving || !draft}>
          Simpan
        </Button>
      </div>
    </form>
  );
}
