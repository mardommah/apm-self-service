import { useEffect } from "react";

/**
 * Kiosk touch screens: long-press opens Chrome's context menu (Back/Reload/Print/Inspect), an escape
 * route out of the kiosk. Block it while a kiosk page is mounted.
 */
export function useBlockContextMenu() {
  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, []);
}
