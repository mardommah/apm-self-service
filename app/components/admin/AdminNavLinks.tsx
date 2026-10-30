import { Link } from "@tanstack/react-router";

const LINKS = [
  { to: "/admin/dashboard", label: "📣 Pemanggil" },
  { to: "/admin/kunjungan", label: "📋 Kunjungan & Statistik" },
] as const;

/** Page navigation shared by the admin navbars. */
export function AdminNavLinks() {
  return (
    <nav aria-label="Menu admin" className="flex items-center gap-1">
      {LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          activeProps={{ className: "bg-blue-50 text-blue-700", "aria-current": "page" }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
