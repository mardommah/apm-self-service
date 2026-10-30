import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { formatDateTime } from "~/lib/utils";
import { createAdminAction, listAdminsAction } from "~/server/actions/admin-users";

const ERRORS: Record<string, string> = {
  USERNAME_INVALID: "Username 3–50 karakter: huruf, angka, titik, garis bawah, atau strip.",
  PASSWORD_TOO_SHORT: "Password minimal 8 karakter.",
  USERNAME_TAKEN: "Username sudah dipakai.",
};
const EMPTY_FORM = { username: "", password: "", role: "admin" };

/** Admin-only: list panel accounts and create new ones. */
export function AdminUsersPanel({ token }: { token: string }) {
  const [users, setUsers] = useState<Awaited<ReturnType<typeof listAdminsAction>>>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = () => listAdminsAction({ data: { token } }).then(setUsers).catch(() => {});
  useEffect(() => {
    load();
  }, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await createAdminAction({ data: { token, ...form } });
      setMessage({ ok: true, text: `Akun "${form.username.trim()}" dibuat.` });
      setForm(EMPTY_FORM);
      await load();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage({ ok: false, text: ERRORS[code] ?? "Gagal membuat akun." });
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "h-10 rounded-md border border-gray-300 px-3 text-sm";
  return (
    <div className="mt-6 border-t pt-6">
      <h3 className="font-semibold text-gray-800">Akun Panel Admin</h3>
      <form onSubmit={handleSubmit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
        <input
          required
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          placeholder="Username"
          aria-label="Username"
          autoComplete="off"
          className={inputClass}
        />
        <input
          required
          type="password"
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="Password (min. 8)"
          aria-label="Password"
          autoComplete="new-password"
          className={inputClass}
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          aria-label="Role"
          className={`${inputClass} bg-white`}
        >
          <option value="admin">Admin</option>
          <option value="security">Petugas (security)</option>
        </select>
        <Button type="submit" disabled={saving}>{saving ? "Menyimpan..." : "Buat Akun"}</Button>
      </form>
      {message && (
        <p role="status" className={`mt-2 text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
      <ul className="mt-4 divide-y rounded-lg border">
        {users.map((user) => (
          <li key={user.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <span className="font-medium text-gray-800">{user.username}</span>
            <span className="text-gray-500">
              {user.role} · login terakhir {user.lastLogin ? formatDateTime(user.lastLogin) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
