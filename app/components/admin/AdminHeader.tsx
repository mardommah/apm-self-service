import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { AdminNavLinks } from "./AdminNavLinks";

/**
 * Navbar shared by the admin pages. Mobile: title + logout on one row, the menu below it scrolls sideways;
 * from `lg` everything sits on one row. `children` = page-specific actions next to "Keluar".
 */
export function AdminHeader({ isAdmin, children }: { isAdmin: boolean; children?: ReactNode }) {
  const navigate = useNavigate();

  async function handleLogout() {
    const { clearToken } = await import("~/lib/auth-client");
    clearToken();
    navigate({ to: "/admin/login" });
  }

  return (
    <header className="border-b border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:flex-nowrap">
        <h1 className="truncate font-bold text-gray-900">🏥 Klinik Syamsinar Maros</h1>
        <div className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6 lg:order-none lg:mx-0 lg:w-auto lg:px-0">
          <AdminNavLinks isAdmin={isAdmin} />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {children}
          <Button variant="outline" size="sm" onClick={handleLogout}>Keluar</Button>
        </div>
      </div>
    </header>
  );
}
