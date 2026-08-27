const DEVICE_KEY = "kiosk_device_id";

function createDeviceId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getDeviceId(): Promise<string> {
  // Return cached device ID
  const cached = localStorage.getItem(DEVICE_KEY);
  if (cached) return cached;

  const id = createDeviceId();

  // Persist so same device always returns same ID
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}
