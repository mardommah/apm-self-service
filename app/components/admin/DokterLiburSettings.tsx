import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import type { DokterLibur, DokterOption } from "~/server/functions/dokter-libur";
import type { SheetMatch } from "~/server/functions/jadwal-sheet";
import { addDokterLiburAction, deleteDokterLiburAction, getDokterLiburAction } from "~/server/actions/dokter-libur";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Makassar" });
const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

/** Marks a doctor TUTUP/CUTI on /display-kamar for a date range (SIMRS jadwal itself is not changed). */
export function DokterLiburSettings({ token }: { token: string }) {
  const [dokter, setDokter] = useState<DokterOption[]>([]);
  const [libur, setLibur] = useState<DokterLibur[]>([]);
  const [sheet, setSheet] = useState<{ enabled: boolean; error: string | null; matches: SheetMatch[] } | null>(null);
  const [form, setForm] = useState({ kdDokter: "", jenis: "tutup", tanggalMulai: today(), tanggalSelesai: today(), keterangan: "" });
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  async function load() {
    try {
      const data = await getDokterLiburAction({ data: { token } });
      setDokter(data.dokter);
      setLibur(data.libur);
      setSheet(data.sheet);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    if (token) void load();
  }, [token]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!form.kdDokter) return;
    setBusy(true);
    try {
      await addDokterLiburAction({ data: { token, ...form } });
      setForm((f) => ({ ...f, kdDokter: "", keterangan: "" }));
      await load();
    } catch {
      alert("Gagal menyimpan. Periksa tanggal (selesai tidak boleh sebelum mulai) lalu coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: DokterLibur) {
    if (!confirm(`Hapus tanda ${item.jenis.toUpperCase()} untuk ${namaDokter(item.kdDokter)}?`)) return;
    setBusy(true);
    try {
      await deleteDokterLiburAction({ data: { token, id: item.id } });
      await load();
    } catch {
      alert("Gagal menghapus. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  const namaDokter = (kd: string) => dokter.find((d) => d.kdDokter === kd)?.nama ?? kd;
  const input = "mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5";

  return (
    <form onSubmit={add} className="mt-4 space-y-3 rounded-lg border p-4">
      <div>
        <p className="font-medium text-gray-800">Dokter tutup / cuti</p>
        <p className="text-sm text-gray-500">
          Dokter yang ditandai tampil <b>TUTUP</b> atau <b>CUTI</b> di jadwal <code>/display-kamar</code> selama rentang tanggal.
          Jadwal di SIMRS tidak diubah.
        </p>
        {loadError && <p className="text-sm text-red-600">Data dokter gagal dimuat (SIMRS / database).</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        <label className="text-sm text-gray-600 sm:col-span-2">
          Dokter
          <select required value={form.kdDokter} onChange={(e) => setForm({ ...form, kdDokter: e.target.value })} className={input}>
            <option value="">Pilih dokter…</option>
            {dokter.map((d) => (
              <option key={d.kdDokter} value={d.kdDokter}>{d.nama}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Status
          <select value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })} className={input}>
            <option value="tutup">Tutup</option>
            <option value="cuti">Cuti</option>
          </select>
        </label>
        <label className="text-sm text-gray-600">
          Mulai
          <input type="date" required value={form.tanggalMulai} onChange={(e) => setForm({ ...form, tanggalMulai: e.target.value })} className={input} />
        </label>
        <label className="text-sm text-gray-600">
          Sampai
          <input type="date" required min={form.tanggalMulai} value={form.tanggalSelesai} onChange={(e) => setForm({ ...form, tanggalSelesai: e.target.value })} className={input} />
        </label>
      </div>
      <div className="flex items-end gap-3">
        <label className="flex-1 text-sm text-gray-600">
          Keterangan (opsional, hanya untuk admin)
          <input maxLength={100} value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} className={input} />
        </label>
        <Button type="submit" size="sm" disabled={busy || !form.kdDokter}>
          Tandai
        </Button>
      </div>

      {sheet?.enabled && (
        <div className="space-y-1 rounded-md border bg-gray-50 p-3 text-sm">
          <p className="font-medium text-gray-700">Dari spreadsheet "Perubahan Jadwal DPJP" hari ini (TUTUP + ACC)</p>
          {sheet.error && <p className="text-red-600">Spreadsheet gagal dibaca ({sheet.error}). Cek tab bulan ini & akses link.</p>}
          {!sheet.error && sheet.matches.length === 0 && <p className="text-gray-500">Tidak ada dokter tutup hari ini.</p>}
          {sheet.matches.map((m, i) => (
            <p key={i} className={m.kdDokter ? "text-gray-700" : "text-orange-700"}>
              {m.kdDokter ? "✓" : "⚠"} {m.dokter} · {m.mulai}–{m.selesai} · {m.alasan}
              {m.kdDokter ? ` → ${m.matchedDokter}` : " → tidak cocok dengan jadwal SIMRS hari ini (tidak tampil di TV; tandai manual bila perlu)"}
            </p>
          ))}
        </div>
      )}

      {libur.length > 0 && (
        <ul className="divide-y rounded-md border text-sm">
          {libur.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span>
                <b className={item.jenis === "cuti" ? "text-orange-700" : "text-red-700"}>{item.jenis.toUpperCase()}</b>{" "}
                {namaDokter(item.kdDokter)} · {fmt(item.tanggalMulai)}
                {item.tanggalSelesai !== item.tanggalMulai && ` – ${fmt(item.tanggalSelesai)}`}
                {item.keterangan && <span className="text-gray-500"> · {item.keterangan}</span>}
              </span>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => remove(item)}>
                Hapus
              </Button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
