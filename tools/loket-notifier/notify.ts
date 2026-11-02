export type ServiceNewest = { serviceCode: string; label: string; waiting: number; newest: { id: string; queueNumber: string } | null };

/** Newest waiting ticket per service, to compare with the next poll. */
export const seenOf = (state: ServiceNewest[]) => Object.fromEntries(state.map((s) => [s.serviceCode, s.newest?.id ?? null]));

/** Services whose newest waiting ticket changed since the last poll (same rule as the dashboard toast). */
export const arrived = (seen: Record<string, string | null>, state: ServiceNewest[]) =>
  state.filter((s) => s.newest && s.newest.id !== seen[s.serviceCode]);

const escapeXml = (text: string) =>
  text.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

export function toastXml(items: ServiceNewest[]) {
  const lines = items.map((s) => `${s.label}: ${s.newest!.queueNumber} (${s.waiting} menunggu)`).join("\n");
  return `<toast><visual><binding template="ToastGeneric"><text>🔔 Antrean baru masuk</text><text>${escapeXml(lines)}</text></binding></visual><audio src="ms-winsoundevent:Notification.Default"/></toast>`;
}
