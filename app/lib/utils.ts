import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTime(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function formatDateTime(date: Date | string | null): string {
  if (!date) return "-";
  return `${formatDate(date)}, ${formatTime(date)}`;
}

export function formatVisitId(id: string): string {
  // Shorten ULID for display: first 4 + last 6 chars
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}-${id.slice(-6)}`;
}

export const SERVICE_ICONS: Record<string, string> = {
  registrasi: "📋",
  poli_umum: "🩺",
  igd: "🚑",
  laboratorium: "🧪",
};

export const STATUS_LABELS: Record<string, string> = {
  waiting: "Menunggu",
  served: "Dilayani",
  revoked: "Dibatalkan",
};
