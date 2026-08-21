const DEVICE_KEY = "kiosk_device_id";

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getDeviceId(): Promise<string> {
  // Return cached device ID
  const cached = localStorage.getItem(DEVICE_KEY);
  if (cached) return cached;

  // Generate fingerprint from browser properties
  const fingerprint = [
    navigator.userAgent,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    String(navigator.hardwareConcurrency ?? 0),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
  ].join("|");

  const hash = await sha256(fingerprint);

  // Persist so same device always returns same ID
  localStorage.setItem(DEVICE_KEY, hash);
  return hash;
}
